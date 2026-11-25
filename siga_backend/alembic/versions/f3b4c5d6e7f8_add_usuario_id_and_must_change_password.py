"""add usuario_id and must_change_password

Revision ID: f3b4c5d6e7f8
Revises: e9f0a1b2c3d4
Create Date: 2026-11-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f3b4c5d6e7f8'
down_revision: Union[str, None] = 'e9f0a1b2c3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    if inspector.has_table('core_users'):
        columnas_usuario = {columna['name'] for columna in inspector.get_columns('core_users')}
        if 'must_change_password' not in columnas_usuario:
            op.add_column(
                'core_users',
                sa.Column(
                    'must_change_password',
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.text('false'),
                ),
            )

    if not inspector.has_table('estudiantes') or not inspector.has_table('core_users'):
        return

    columnas_estudiante = {columna['name'] for columna in inspector.get_columns('estudiantes')}
    if 'usuario_id' not in columnas_estudiante:
        op.add_column('estudiantes', sa.Column('usuario_id', sa.Integer(), nullable=True))

    indexes = {indice['name'] for indice in inspector.get_indexes('estudiantes')}
    if 'ix_estudiantes_usuario_id' not in indexes:
        op.create_index('ix_estudiantes_usuario_id', 'estudiantes', ['usuario_id'], unique=False)

    uniques = {uq['name'] for uq in inspector.get_unique_constraints('estudiantes')}
    if 'uq_estudiantes_usuario_id' not in uniques:
        op.create_unique_constraint('uq_estudiantes_usuario_id', 'estudiantes', ['usuario_id'])

    foreign_keys = {fk['name'] for fk in inspector.get_foreign_keys('estudiantes') if fk.get('name')}
    if 'fk_estudiantes_usuario_id_core_users' not in foreign_keys:
        op.create_foreign_key(
            'fk_estudiantes_usuario_id_core_users',
            'estudiantes',
            'core_users',
            ['usuario_id'],
            ['id'],
            ondelete='SET NULL',
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    if inspector.has_table('estudiantes'):
        columnas_estudiante = {columna['name'] for columna in inspector.get_columns('estudiantes')}
        if 'usuario_id' in columnas_estudiante:
            foreign_keys = {fk['name'] for fk in inspector.get_foreign_keys('estudiantes') if fk.get('name')}
            if 'fk_estudiantes_usuario_id_core_users' in foreign_keys:
                op.drop_constraint('fk_estudiantes_usuario_id_core_users', 'estudiantes', type_='foreignkey')

            uniques = {uq['name'] for uq in inspector.get_unique_constraints('estudiantes')}
            if 'uq_estudiantes_usuario_id' in uniques:
                op.drop_constraint('uq_estudiantes_usuario_id', 'estudiantes', type_='unique')

            indexes = {indice['name'] for indice in inspector.get_indexes('estudiantes')}
            if 'ix_estudiantes_usuario_id' in indexes:
                op.drop_index('ix_estudiantes_usuario_id', table_name='estudiantes')

            op.drop_column('estudiantes', 'usuario_id')

    if inspector.has_table('core_users'):
        columnas_usuario = {columna['name'] for columna in inspector.get_columns('core_users')}
        if 'must_change_password' in columnas_usuario:
            op.drop_column('core_users', 'must_change_password')
