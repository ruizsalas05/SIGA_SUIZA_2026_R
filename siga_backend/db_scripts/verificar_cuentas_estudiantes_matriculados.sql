SELECT
    COUNT(*) AS matriculados,
    COUNT(*) FILTER (WHERE e.usuario_id IS NOT NULL) AS con_vinculo,
    COUNT(*) FILTER (
        WHERE e.usuario_id IS NULL
          AND NOT EXISTS (
              SELECT 1
              FROM core_users u
              WHERE lower(u.email) IN (
                  lower(e.email_institucional),
                  lower(e.email_personal),
                  regexp_replace(e.dni, '\D', '', 'g') || '@siga.edu'
              )
          )
    ) AS sin_cuenta
FROM estudiantes e
WHERE EXISTS (
    SELECT 1
    FROM matriculas m
    WHERE m.estudiante_id = e.id
      AND m.estado_matricula NOT IN ('anulada', 'anulada_por_reserva')
);

SELECT
    e.id AS estudiante_id,
    e.codigo_estudiante,
    e.dni,
    e.nombres,
    e.apellidos,
    e.usuario_id
FROM estudiantes e
WHERE EXISTS (
    SELECT 1
    FROM matriculas m
    WHERE m.estudiante_id = e.id
      AND m.estado_matricula NOT IN ('anulada', 'anulada_por_reserva')
)
  AND e.usuario_id IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM core_users u
      WHERE lower(u.email) IN (
          lower(e.email_institucional),
          lower(e.email_personal),
          regexp_replace(e.dni, '\D', '', 'g') || '@siga.edu'
      )
  )
ORDER BY e.apellidos, e.nombres;
