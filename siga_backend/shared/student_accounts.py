import re
from typing import Any, Dict, Optional

import bcrypt
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _valor(estudiante: Any, nombre: str, default: Any = None) -> Any:
    if isinstance(estudiante, dict):
        valor = estudiante.get(nombre)
    else:
        valor = getattr(estudiante, nombre, None)
    return default if valor is None else valor


async def _usuario_por_id(db: AsyncSession, usuario_id: int) -> Optional[Dict[str, Any]]:
    resultado = await db.execute(
        text("SELECT id, email, is_active FROM core_users WHERE id = :uid"),
        {"uid": usuario_id},
    )
    fila = resultado.mappings().first()
    return dict(fila) if fila else None


async def _usuario_por_email(db: AsyncSession, emails: list) -> Optional[Dict[str, Any]]:
    if not emails:
        return None
    resultado = await db.execute(
        text("""
            SELECT id, email, is_active
            FROM core_users
            WHERE lower(email) = ANY(:emails)
            ORDER BY id
            LIMIT 1
        """),
        {"emails": emails},
    )
    fila = resultado.mappings().first()
    return dict(fila) if fila else None


async def _vincular(db: AsyncSession, estudiante: Any, usuario_id: int) -> None:
    estudiante_id = int(_valor(estudiante, "id"))
    await db.execute(
        text("UPDATE estudiantes SET usuario_id = :uid WHERE id = :sid"),
        {"uid": usuario_id, "sid": estudiante_id},
    )
    if hasattr(estudiante, "usuario_id"):
        setattr(estudiante, "usuario_id", usuario_id)


async def asegurar_cuenta_estudiante(db: AsyncSession, estudiante: Any) -> Dict[str, Any]:
    estudiante_id = int(_valor(estudiante, "id"))
    dni = str(_valor(estudiante, "dni", "") or "").strip()
    dni_digitos = re.sub(r"\D", "", dni)
    if not dni_digitos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede crear la cuenta: el estudiante no tiene DNI válido.",
        )

    nombres = str(_valor(estudiante, "nombres", "") or "").strip()
    apellidos = str(_valor(estudiante, "apellidos", "") or "").strip()
    full_name = f"{nombres} {apellidos}".strip() or dni_digitos

    email_institucional = str(_valor(estudiante, "email_institucional", "") or "").strip().lower()
    email_personal = str(_valor(estudiante, "email_personal", "") or "").strip().lower()
    email_generado = f"{dni_digitos}@siga.edu"
    emails = [email for email in (email_institucional, email_personal, email_generado) if email]
    email_creacion = email_institucional or email_generado

    rol = await db.execute(
        text("SELECT id FROM core_roles WHERE lower(name) = 'estudiante'")
    )
    rol_id = rol.scalar_one_or_none()
    if rol_id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="El rol 'estudiante' no existe en core_roles. No se creó la matrícula.",
        )

    ids_candidatos = []
    usuario_id_actual = _valor(estudiante, "usuario_id")
    if usuario_id_actual:
        ids_candidatos.append(int(usuario_id_actual))

    vinculado = await db.execute(
        text("SELECT usuario_id FROM estudiantes WHERE id = :sid AND usuario_id IS NOT NULL"),
        {"sid": estudiante_id},
    )
    vinculado_id = vinculado.scalar_one_or_none()
    if vinculado_id:
        ids_candidatos.append(int(vinculado_id))

    por_dni = await db.execute(
        text("""
            SELECT usuario_id
            FROM estudiantes
            WHERE dni = :dni AND usuario_id IS NOT NULL
            ORDER BY id
            LIMIT 1
        """),
        {"dni": dni},
    )
    dni_usuario_id = por_dni.scalar_one_or_none()
    if dni_usuario_id:
        ids_candidatos.append(int(dni_usuario_id))

    usuario = None
    for candidato_id in dict.fromkeys(ids_candidatos):
        usuario = await _usuario_por_id(db, candidato_id)
        if usuario:
            break

    if not usuario:
        usuario = await _usuario_por_email(db, list(dict.fromkeys(emails)))

    if usuario:
        usuario_id = int(usuario["id"])
        await _vincular(db, estudiante, usuario_id)
        if not usuario["is_active"]:
            await db.execute(
                text("UPDATE core_users SET is_active = true WHERE id = :uid"),
                {"uid": usuario_id},
            )
            cuenta = "reactivada"
        else:
            cuenta = "existente"
        return {
            "cuenta": cuenta,
            "usuario_id": usuario_id,
            "email": usuario["email"],
        }

    hashed_password = bcrypt.hashpw(dni_digitos.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    creado = await db.execute(
        text("""
            INSERT INTO core_users
                (email, full_name, hashed_password, is_active, is_superuser, must_change_password, created_at)
            VALUES
                (:email, :full_name, :hashed_password, true, false, true, NOW())
            RETURNING id
        """),
        {
            "email": email_creacion,
            "full_name": full_name,
            "hashed_password": hashed_password,
        },
    )
    usuario_id = int(creado.scalar_one())

    await db.execute(
        text("INSERT INTO core_user_roles (user_id, role_id) VALUES (:uid, :rid)"),
        {"uid": usuario_id, "rid": rol_id},
    )
    await _vincular(db, estudiante, usuario_id)

    return {
        "cuenta": "creada",
        "usuario_id": usuario_id,
        "email": email_creacion,
    }
