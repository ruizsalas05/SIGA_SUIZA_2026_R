"""add periodo_admision_id a estudiantes

Revision ID: e9f0a1b2c3d4
Revises: c4d5e6f7a8b9
Create Date: 2026-11-24 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e9f0a1b2c3d4'
down_revision: Union[str, None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table('estudiantes'):
        return

    columnas = {columna['name'] for columna in inspector.get_columns('estudiantes')}
    if 'periodo_admision_id' not in columnas:
        op.add_column('estudiantes', sa.Column('periodo_admision_id', sa.Integer(), nullable=True))
        op.create_index('ix_estudiantes_periodo_admision_id', 'estudiantes', ['periodo_admision_id'], unique=False)

    if inspector.has_table('outbox_events') and inspector.has_table('periodos_academicos'):
        op.execute("""
            UPDATE estudiantes e
            SET periodo_admision_id = p.id
            FROM outbox_events oe, periodos_academicos p
            WHERE e.periodo_admision_id IS NULL
              AND oe.event_type = 'gestion_academica.admision.estudiante_ingresado'
              AND (oe.payload->'data'->>'estudiante_id')::int = e.id
              AND p.codigo = replace(oe.payload->>'proceso_admision_id', 'ADM-', '')
        """)


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table('estudiantes'):
        return
    columnas = {columna['name'] for columna in inspector.get_columns('estudiantes')}
    if 'periodo_admision_id' in columnas:
        op.drop_index('ix_estudiantes_periodo_admision_id', table_name='estudiantes')
        op.drop_column('estudiantes', 'periodo_admision_id')
