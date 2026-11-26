/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiClient } from '../../core/api/client';
import { useAuth } from '../../core/auth/useAuth';
import { useToast } from '../../core/ui/ToastContext';
import { GraduationCap, Calendar, X, FileSpreadsheet, SearchX, Eye } from 'lucide-react';

function useSafeToast() {
  try {
    return useToast();
  } catch {
    const noop = () => {};
    return {
      toast: { success: noop, error: noop, warning: noop, info: noop, dismiss: noop, clear: noop },
      success: noop,
      error: noop,
      warning: noop,
      info: noop,
      showSuccess: noop,
      showError: noop,
      showWarning: noop,
      showInfo: noop,
      dismiss: noop,
      clear: noop,
      toasts: [],
    };
  }
}

const ACTA_NUMEROS = ['CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE'];

const escaparHtml = (valor) => String(valor ?? '').replace(/[&<>"']/g, (caracter) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[caracter]));

const numeroALetras = (valor) => {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 0 && numero <= 20 ? ACTA_NUMEROS[numero] : 'NO EVALUADO';
};

function construirActaPdfHtml({ programa, periodo, unidad, docente, estudiantes }) {
  const calificados = estudiantes.filter((est) => est.nota_final !== '-' && !Number.isNaN(Number(est.nota_final)));
  const aprobados = calificados.filter((est) => Number(est.nota_final) >= 13).length;
  const desaprobados = calificados.length - aprobados;
  const porcentaje = calificados.length ? Math.round((aprobados / calificados.length) * 100) : 0;
  const filas = estudiantes.map((est, indice) => {
    const nota = est.nota_final === '-' ? '-' : String(Number(est.nota_final)).padStart(2, '0');
    const condicion = est.nota_final === '-' ? 'SIN NOTA' : Number(est.nota_final) >= 13 ? 'APROBADO' : 'DESAPROBADO';
    return `<tr><td>${indice + 1}</td><td class="nombre">${escaparHtml(est.name)}</td><td class="nota">${escaparHtml(nota)}</td><td>${numeroALetras(est.nota_final)}</td><td>${condicion}</td></tr>`;
  }).join('');

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Acta Oficial MINEDU - ${escaparHtml(unidad?.nombre || 'Unidad Didáctica')}</title><style>
    @page{size:A4 landscape;margin:12mm}body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:11px;margin:0}
    header{text-align:center;border-bottom:2px solid #0f172a;padding-bottom:10px;margin-bottom:14px}
    header .minedu{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#475569}
    header h1{font-size:17px;text-transform:uppercase;margin:4px 0 6px;letter-spacing:.4px}
    header .acta{display:inline-block;border:1px solid #0f172a;background:#f1f5f9;padding:5px 12px;font-weight:800;text-transform:uppercase}
    .datos{display:grid;grid-template-columns:repeat(2,1fr);gap:7px 20px;background:#f8fafc;border:1px solid #cbd5e1;padding:10px 12px;margin-bottom:14px}
    .datos span{display:block;font-size:8px;font-weight:800;text-transform:uppercase;color:#64748b}
    .datos b{font-size:11px}table{width:100%;border-collapse:collapse;margin-bottom:14px}th,td{border:1px solid #94a3b8;padding:6px 8px;text-align:center}
    th{background:#e2e8f0;text-transform:uppercase;font-size:9px}.nombre{text-align:left;font-weight:700}.nota{font-size:13px;font-weight:800}
    .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;text-align:center;margin-bottom:26px}
    .stats div{border:1px solid #cbd5e1;background:#f8fafc;padding:8px}.stats span{display:block;font-size:8px;text-transform:uppercase;color:#64748b;font-weight:800}.stats b{font-size:14px}
    .firmas{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;text-align:center}.firma{border-top:1px solid #0f172a;padding-top:6px}.firma b{display:block}.firma small{color:#64748b}
    footer{border-top:1px solid #e2e8f0;margin-top:26px;padding-top:7px;text-align:center;color:#64748b;font-size:8px}
  </style></head><body>
    <header><div class="minedu">República del Perú · Ministerio de Educación</div><h1>Instituto de Educación Superior Tecnológico Público "Suiza"</h1><div class="acta">Acta consolidada de evaluación final de unidad didáctica</div></header>
    <section class="datos">
      <div><span>Programa de estudios</span><b>${escaparHtml(programa)}</b></div>
      <div><span>Periodo académico</span><b>${escaparHtml(periodo)}</b></div>
      <div><span>Unidad didáctica</span><b>${escaparHtml(unidad?.nombre || '-')}</b></div>
      <div><span>Módulo formativo</span><b>${escaparHtml(unidad?.moduloNombre || '-')}</b></div>
      <div><span>Docente responsable</span><b>${escaparHtml(docente || 'Docente Titular')}</b></div>
      <div><span>Fecha de emisión</span><b>${escaparHtml(new Date().toLocaleDateString('es-PE'))}</b></div>
    </section>
    <table><thead><tr><th>N°</th><th>Apellidos y Nombres</th><th>Nota (N°)</th><th>Nota en Letras</th><th>Condición</th></tr></thead><tbody>${filas || '<tr><td colspan="5">Sin estudiantes matriculados</td></tr>'}</tbody></table>
    <section class="stats"><div><span>Matriculados</span><b>${estudiantes.length}</b></div><div><span>Aprobados</span><b>${aprobados}</b></div><div><span>Desaprobados</span><b>${desaprobados}</b></div><div><span>% Aprobación</span><b>${porcentaje}%</b></div></section>
    <section class="firmas"><div class="firma"><b>Firma del Docente</b><small>${escaparHtml(docente || 'Docente Titular')}</small></div><div class="firma"><b>Coordinación de Carrera</b><small>Visto Bueno</small></div><div class="firma"><b>Secretaría Académica</b><small>Recepción Oficial</small></div></section>
    <footer>Documento generado por el Sistema Integrado de Gestión Académica (SIGA) · Formato institucional MINEDU · ${escaparHtml(new Date().toLocaleString('es-PE'))}</footer>
  </body></html>`;
}

function exportarActaPdf({ programa, periodo, unidad, docente, estudiantes }) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(construirActaPdfHtml({ programa, periodo, unidad, docente, estudiantes }));
  doc.close();
  window.setTimeout(() => {
    if (typeof iframe.contentWindow?.print === 'function') {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } else {
      window.print();
    }
    window.setTimeout(() => iframe.remove(), 1500);
  }, 150);
}

export function CoordinatorSupervision() {
  const { user } = useAuth();
  const { toast } = useSafeToast();
  const [loading, setLoading] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [malla, setMalla] = useState([]);
  
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  
  const [selectedViewUD, setSelectedViewUD] = useState(null);
  const [udStudents, setUdStudents] = useState([]);
  const [loadingUD, setLoadingUD] = useState(false);

  // Bloquear scroll del body y cerrar con Escape mientras el acta está abierta.
  // El modal se renderiza en un Portal (document.body) para que `fixed inset-0`
  // no quede atrapado por el `transform` de `.animate-fade-in` del contenedor
  // ni por debajo del navbar sticky (z-50). Sin portal, el acta quedaba
  // recortada/oculta debajo del header.
  useEffect(() => {
    if (!selectedViewUD) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') setSelectedViewUD(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [selectedViewUD]);

  // Initial data load
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [progRes, perRes, personalRes] = await Promise.all([
          apiClient.request('/api/mod-programas-estudio/programas').catch(() => []),
          apiClient.request('/api/mod-programas-estudio/periodos').catch(() => []),
          apiClient.request('/api/mod-usuarios/personal').catch(() => [])
        ]);
        
        setPrograms(progRes || []);
        setPeriods(perRes || []);
        
        let hasProgram = false;
        if (personalRes && user) {
          const myProfile = personalRes.find(p => p?.usuario?.id === user.id);
          if (myProfile?.perfil?.programa_estudio_id) {
            setSelectedProgram(myProfile.perfil.programa_estudio_id.toString());
            hasProgram = true;
          }
        }
        
        if (!hasProgram && progRes && progRes.length > 0) {
          setSelectedProgram(progRes[0].id.toString());
        }
        
        if (perRes && perRes.length > 0) {
          const active = perRes.find(p => ['ACTIVO', 'activo', 'matricula_abierta', 'en_curso'].includes(p.estado)) || perRes[0];
          setSelectedPeriod(active ? active.id.toString() : perRes[0].id.toString());
        }
      } catch (e) {
        console.error('Error fetching initial data', e);
      }
    };
    if (user) fetchInitial();
  }, [user]);

  // Load Malla when program is selected
  useEffect(() => {
    if (!selectedProgram) {
      setMalla([]);
      setSelectedViewUD(null);
      return;
    }
    const fetchMalla = async () => {
      setLoading(true);
      try {
        const res = await apiClient.request(`/api/mod-programas-estudio/programas/${selectedProgram}/malla`);
        // Avance real de notas por unidad (matriculados vs. notas registradas)
        const resumen = selectedPeriod
          ? await apiClient.request(`/api/mod-evaluacion/resumen/periodo/${selectedPeriod}`).catch(() => [])
          : [];
        const avancePorUnidad = new Map((resumen || []).map(r => [r.unidad_didactica_id, r.porcentaje]));
        const enhancedMalla = (res || []).map(modulo => ({
          ...modulo,
          unidades: modulo.unidades.map(u => ({
            ...u,
            completion: avancePorUnidad.get(u.id) ?? 0,
            isEmpleabilidad: /comunicaci|ingl[eé]s|ofim[aá]tica|emprendimiento/i.test(u.nombre) || /empleabilidad|transversal/i.test(modulo.nombre)
          }))
        }));
        setMalla(enhancedMalla);
      } catch (e) {
        console.error('Error fetching malla', e);
      }
      setLoading(false);
    };
    fetchMalla();
  }, [selectedProgram, selectedPeriod]);

  const handleViewActa = async (unidad, moduloNombre) => {
    if (!selectedPeriod) {
      toast.warning("Por favor, seleccione un periodo académico primero.");
      return;
    }
    setSelectedViewUD({ ...unidad, moduloNombre });
    setLoadingUD(true);
    try {
      const enrolled = await apiClient.request(`/api/mod-gestion-academica/matriculas/unidad/${unidad.id}/periodo/${selectedPeriod}`).catch(() => []);
      const grades = await apiClient.request(`/api/mod-evaluacion/registros/unidad/${unidad.id}/periodo/${selectedPeriod}`).catch(() => []);
      
      const combined = enrolled.map(est => {
        const gradeRecord = grades.find(g => g.matricula_detalle_id === est.matricula_detalle_id);
        
        return {
          id: est.id,
          name: `${est.apellidos}, ${est.nombres}`,
          nota_final: gradeRecord?.nota_final ?? '-',
          estado: gradeRecord?.estado || 'Sin Registrar'
        };
      });
      
      combined.sort((a, b) => a.name.localeCompare(b.name));
      setUdStudents(combined);
    } catch (e) {
      console.error('Error fetching actas', e);
    }
    setLoadingUD(false);
  };

  const userRoles = Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : []);
  const isCoordinador = !user?.is_superuser && userRoles.includes('coordinador_programa');

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h3 className="text-3xl font-bold tracking-tight text-slate-text">
            Supervisión de <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary-dark">Actas y Evaluación</span>
          </h3>
          <p className="text-slate-500 text-sm mt-1">Vista gerencial para Coordinadores de Programa y Secretaría</p>
        </div>
      </div>

      {/* Contexto Operativo Informativo */}
      <div className="glass-card p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-l-4 border-l-primary mb-6 bg-gradient-to-r from-white to-slate-50">
        <div className="flex items-center space-x-3 w-full md:w-auto flex-1">
          <div className="w-10 h-10 rounded-full bg-primary-soft flex items-center justify-center text-primary flex-shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div className="w-full">
            <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Programa de Estudios</p>
            {isCoordinador ? (
              <div className="w-full bg-transparent font-bold text-slate-800 border-none p-0 text-sm mt-1">
                {programs.find(p => p.id.toString() === selectedProgram)?.nombre || "Cargando..."}
              </div>
            ) : (
              <select 
                className="w-full bg-transparent font-bold text-slate-800 border-none p-0 focus:ring-0 cursor-pointer text-sm"
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
              >
                <option value="" disabled>Seleccione un programa...</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id.toString()}>{p.nombre}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="w-10 h-10 rounded-full bg-primary-soft flex items-center justify-center text-primary flex-shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="w-full">
            <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Periodo Activo</p>
            {isCoordinador ? (
              <div className="w-full bg-transparent font-bold text-slate-800 border-none p-0 text-sm mt-1">
                {periods.find(p => p.id.toString() === selectedPeriod)?.codigo || "Cargando..."}
              </div>
            ) : (
              <select 
                className="w-full bg-transparent font-bold text-slate-800 border-none p-0 focus:ring-0 cursor-pointer text-sm"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              >
                <option value="" disabled>Seleccione un periodo...</option>
                {periods.map(p => (
                  <option key={p.id} value={p.id.toString()}>{p.codigo}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="py-12 text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {selectedProgram && selectedPeriod && !loading && (
        <div className="space-y-6 mt-6">
          <h4 className="text-xl font-bold text-slate-text border-b pb-2">Estado de Actas por Módulo Formativo</h4>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {malla.map(modulo => (
              <div key={modulo.id} className="glass-card p-0 overflow-hidden shadow-md">
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-4">
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Ciclo {modulo.periodo}</div>
                  <h5 className="font-semibold">{modulo.nombre}</h5>
                </div>
                <div className="p-4 space-y-4">
                  {modulo.unidades.map(u => (
                    <div key={u.id} className="flex flex-col border border-slate-100 rounded-lg p-3 hover:shadow-sm transition-all bg-white/50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-bold text-slate-text text-sm block">{u.nombre}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${u.isEmpleabilidad ? 'bg-amber-100 text-amber-700' : 'bg-primary-soft text-primary'}`}>
                            {u.isEmpleabilidad ? 'Transversal / Empleabilidad' : 'Específica'}
                          </span>
                        </div>
                        <button 
                          onClick={() => handleViewActa(u, modulo.nombre)}
                          className="text-xs bg-primary-soft hover:bg-primary/20 text-primary font-semibold py-1.5 px-3 rounded-lg transition-colors border border-primary/20 flex items-center"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> Ver Acta
                        </button>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2.5 mt-2 overflow-hidden">
                        <div className={`h-2.5 rounded-full ${u.completion === 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${u.completion}%` }}></div>
                      </div>
                      <div className="flex justify-between text-[10px] font-semibold text-slate-500 mt-1">
                        <span>Avance de Registro</span>
                        <span className={u.completion === 100 ? 'text-green-600' : ''}>{u.completion}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal / Vista Detallada de Acta (Portal a body: evita recorte bajo el header) */}
      {selectedViewUD && createPortal(
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedViewUD(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in m-auto overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedViewUD.isEmpleabilidad ? 'bg-amber-100 text-amber-700' : 'bg-primary-soft text-primary'}`}>
                    {selectedViewUD.isEmpleabilidad ? 'Transversal / Empleabilidad' : 'Específica'}
                  </span>
                  <span className="text-xs font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                    Periodo: {periods.find(p => p.id === parseInt(selectedPeriod))?.codigo}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-text">{selectedViewUD.nombre}</h3>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{selectedViewUD.moduloNombre}</p>
              </div>
              <button 
                onClick={() => setSelectedViewUD(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-red-100 hover:text-red-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-0 overflow-y-auto flex-1 bg-slate-50/50">
              {loadingUD ? (
                <div className="py-20 text-center">
                  <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-slate-500 font-medium text-sm">Recuperando registros oficiales...</p>
                </div>
              ) : udStudents.length === 0 ? (
                <div className="py-16 text-center text-slate-500">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary-soft flex items-center justify-center text-primary"><SearchX className="w-10 h-10" /></div>
                  <p>No hay estudiantes matriculados en esta UD.</p>
                </div>
              ) : (
                <table className="data-table w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-800 text-white sticky top-0">
                    <tr>
                      <th className="py-3 px-4 font-semibold w-12 text-center">N°</th>
                      <th className="py-3 px-4 font-semibold">Estudiante</th>
                      <th className="py-3 px-4 font-bold text-center w-24 bg-slate-700/50">Nota Final</th>
                      <th className="py-3 px-4 font-semibold text-center w-28">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {udStudents.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-primary-soft/40 transition-colors">
                        <td className="py-3 px-4 text-center text-slate-400 font-medium">{idx + 1}</td>
                        <td className="py-3 px-4 font-semibold text-slate-text">{s.name}</td>
                        <td className={`py-3 px-4 text-center font-bold text-lg bg-slate-50 shadow-[inset_1px_0_0_rgba(0,0,0,0.05)] ${
                          s.nota_final === '-' ? 'text-slate-400' : 
                          parseInt(s.nota_final) >= 13 ? 'text-primary' : 'text-red-600'
                        }`}>
                          {s.nota_final}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`badge ${
                            s.estado === 'aprobado' ? 'badge-green' :
                            s.estado === 'desaprobado' ? 'badge-red' :
                            'badge-slate'
                          }`}>
                            {s.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-between items-center">
              <div className="text-xs text-slate-500 font-medium flex items-center">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                Modo Auditoría: Solo Lectura
              </div>
              <button 
                className="btn-primary text-sm px-4 py-2 flex items-center"
                onClick={() => exportarActaPdf({
                  programa: programs.find(p => p.id.toString() === selectedProgram)?.nombre || '',
                  periodo: periods.find(p => p.id.toString() === selectedPeriod)?.codigo || '',
                  unidad: selectedViewUD,
                  docente: user?.full_name,
                  estudiantes: udStudents,
                })}
              >
                <FileSpreadsheet className="w-4 h-4 mr-1" /> Exportar a PDF (MINEDU)
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
