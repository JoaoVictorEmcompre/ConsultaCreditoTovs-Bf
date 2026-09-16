import "./HistoricoInteracoes.css";
import { LuHistory as History, LuPhone as Phone, LuMail as Mail, LuInfo as Info, LuFileText as FileText } from "react-icons/lu";
import { FaWhatsapp } from "react-icons/fa";
import EmptyState from "../common/EmptyState.jsx";

function getTipoIcon(tipo) {
    switch (tipo) {
        case "Ligação":
            return <Phone size={16} />;
        case "WhatsApp":
            return <FaWhatsapp size={16} />;
        case "E-mail":
            return <Mail size={16} />;
        default:
            return <Info size={16} />;
    }
}

function getResultadoClass(resultado) {
    switch (resultado) {
        case "Acordo Realizado":
            return "resultado-acordo";
        case "Promessa de Pagamento":
            return "resultado-promessa";
        case "Contato Realizado":
            return "resultado-contato";
        case "Não Atendeu":
            return "resultado-nao-atendeu";
        default:
            return "";
    }
}

function getTipoClass(tipo) {
    switch (tipo) {
        case "Ligação":
            return "tipo-ligacao";
        case "WhatsApp":
            return "tipo-whatsapp";
        case "E-mail":
            return "tipo-email";
        default:
            return "";
    }
}

function HistoricoInteracoes({interacoes}) {
    return (
        <section className="historico-section">
            <div className="section-header">
                <div className="section-title-group">
                    <History size={20} />
                    <h2>Hist&oacute;rico de Intera&ccedil;&otilde;es</h2>
                </div>
                <span className="record-count">{interacoes.length} registros</span>
            </div>

            <div className="timeline-card">
                {interacoes.length === 0 ? (
                    <EmptyState
                        icon={History}
                        title="Nenhuma interação registrada"
                        subtitle="Os contatos registrados com esse cliente aparecerão aqui."
                    />
                ) : (
                    <div className="timeline">
                        {interacoes.map((item, index) => (
                            <div key={item.id} className={`timeline-item ${index === 0 ? "timeline-item-latest" : ""}`}>
                                <div className="timeline-marker">
                                    <div className={`timeline-dot ${getTipoClass(item.tipo)}`}>
                                        {getTipoIcon(item.tipo)}
                                    </div>
                                    {index < interacoes.length - 1 && <div className="timeline-line"/>}
                                </div>

                                <div className="timeline-content">
                                    <div className="timeline-header-row">
                                        <div className="timeline-meta">
                                            <span className="timeline-date">{item.data}</span>
                                            <span className="timeline-hora">{item.hora}</span>
                                            <span className="timeline-operador">por {item.operador}</span>
                                        </div>
                                        <span className={`timeline-resultado ${getResultadoClass(item.resultado)}`}>
                        {item.resultado}
                      </span>
                                    </div>

                                    <p className="timeline-observacao">{item.observacao}</p>

                                    {item.acordo && (
                                        <div className="timeline-acordo">
                                            <FileText size={14} />
                                            <span>
                          {item.acordo.tipo} &mdash;{" "}
                                                {item.acordo.valor.toLocaleString("pt-BR", {
                                                    style: "currency",
                                                    currency: "BRL"
                                                })}
                                                {item.acordo.parcelas > 1 ? ` em ${item.acordo.parcelas}x` : " à vista"}
                        </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

export default HistoricoInteracoes;
