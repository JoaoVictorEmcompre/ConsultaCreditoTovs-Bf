import "./HistoricoInteracoes.css";

function getTipoIcon(tipo) {
    switch (tipo) {
        case "Ligação":
            return (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path
                        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
            );
        case "WhatsApp":
            return (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path
                        d="M20.52 3.5A11.64 11.64 0 0 0 12 0 11.66 11.66 0 0 0 .34 11.66a11.3 11.3 0 0 0 1.67 5.95L0 24l6.6-1.72a11.61 11.61 0 0 0 5.41 1.38h.01A11.66 11.66 0 0 0 24 11.66a11.53 11.53 0 0 0-3.48-8.16zM12 21.5a9.5 9.5 0 0 1-4.84-1.32l-.35-.21-3.92 1L3.5 17l-.23-.36a9.5 9.5 0 1 1 17.72-5.32A9.53 9.53 0 0 1 12 21.5zm5.06-7.24c-.28-.14-1.66-.82-1.92-.91s-.45-.14-.64.14-.73.91-.9 1.09-.33.21-.61.07a7.79 7.79 0 0 1-2.29-1.41 8.59 8.59 0 0 1-1.59-1.97c-.17-.28 0-.42.13-.56s.28-.33.42-.5a1.89 1.89 0 0 0 .28-.47.5.5 0 0 0 0-.47c0-.14-.64-1.55-.88-2.12s-.47-.49-.64-.49h-.55a1.06 1.06 0 0 0-.76.35 3.2 3.2 0 0 0-1 2.37 5.56 5.56 0 0 0 1.16 2.94 12.81 12.81 0 0 0 4.92 4.3 16 16 0 0 0 1.6.59 3.89 3.89 0 0 0 1.78.11 2.91 2.91 0 0 0 1.91-1.34 2.36 2.36 0 0 0 .16-1.34c-.07-.14-.25-.21-.53-.35z"/>
                </svg>
            );
        case "E-mail":
            return (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                </svg>
            );
        default:
            return (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
            );
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
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <h2>Hist&oacute;rico de Intera&ccedil;&otilde;es</h2>
                </div>
                <span className="record-count">{interacoes.length} registros</span>
            </div>

            <div className="timeline-card">
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
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                             stroke="currentColor" strokeWidth="2">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                            <polyline points="14 2 14 8 20 8"/>
                                        </svg>
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
            </div>
        </section>
    );
}

export default HistoricoInteracoes;
