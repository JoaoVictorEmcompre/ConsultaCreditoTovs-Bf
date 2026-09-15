import { Fragment, useState } from "react";
import "./TicketsZammad.css";
import { Ticket, ChevronDown, Inbox, MessageSquare, Lock } from "lucide-react";
import { getZammadTicketArticles } from "../../services/zammad.js";

const ESTADO_LABELS = {
    new: "Novo",
    open: "Aberto",
    "pending reminder": "Pendente",
    "pending close": "Pendente (fechamento)",
    closed: "Fechado",
    merged: "Mesclado",
};

const ESTADOS_FECHADOS = ["closed", "merged"];

function labelEstado(estado) {
    if (!estado) return "-";
    return ESTADO_LABELS[estado] || estado;
}

function classeEstado(estado) {
    if (ESTADOS_FECHADOS.includes(estado)) return "zammad-pill zammad-pill-fechado";
    if (estado === "open" || estado === "new") return "zammad-pill zammad-pill-aberto";
    return "zammad-pill zammad-pill-pendente";
}

function formatData(iso) {
    if (!iso) return "---";
    const data = new Date(iso);
    if (Number.isNaN(data.getTime())) return "---";
    return data.toLocaleDateString("pt-BR");
}

function formatDataHora(iso) {
    if (!iso) return "---";
    const data = new Date(iso);
    if (Number.isNaN(data.getTime())) return "---";
    return data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

// O corpo do artigo pode vir em HTML (e-mails) — nunca renderizamos esse HTML
// direto (risco de XSS). Em vez disso extraímos só o texto via um documento
// isolado (DOMParser), que nunca chega a ser inserido na página.
function htmlParaTexto(html) {
    if (!html) return "";
    try {
        const doc = new DOMParser().parseFromString(html, "text/html");
        return (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
    } catch {
        return html;
    }
}

function DetalheCampo({ label, valor }) {
    if (!valor || valor === "-") return null;
    return (
        <div className="zammad-detalhe-campo">
            <span className="zammad-detalhe-label">{label}</span>
            <span className="zammad-detalhe-valor">{valor}</span>
        </div>
    );
}

function ArtigoTicket({ artigo }) {
    const texto = htmlParaTexto(artigo.body);

    return (
        <div className={`zammad-artigo ${artigo.internal ? "zammad-artigo-interno" : ""}`}>
            <div className="zammad-artigo-header">
                <span className="zammad-artigo-de">{artigo.from || artigo.created_by || "-"}</span>
                <span className="zammad-artigo-data">{formatDataHora(artigo.created_at)}</span>
                {artigo.internal && (
                    <span className="zammad-artigo-nota-interna">
                        <Lock size={11} /> Nota interna
                    </span>
                )}
            </div>
            {texto && <p className="zammad-artigo-corpo">{texto}</p>}
        </div>
    );
}

function TicketRow({ ticket }) {
    const [expandido, setExpandido] = useState(false);
    const [artigos, setArtigos] = useState(null);
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState(null);

    async function alternarExpansao() {
        const abrindo = !expandido;
        setExpandido(abrindo);

        if (abrindo && artigos === null && !carregando) {
            setCarregando(true);
            setErro(null);
            try {
                const dados = await getZammadTicketArticles(ticket.id, ticket.customer);
                setArtigos(dados);
            } catch (err) {
                setErro(err.message || "Erro ao carregar a conversa do ticket.");
            } finally {
                setCarregando(false);
            }
        }
    }

    return (
        <Fragment>
            <tr className="zammad-row" onClick={alternarExpansao}>
                <td className="col-expand">
                    <button
                        type="button"
                        className="row-expand-button"
                        aria-label="Ver detalhes do ticket"
                    >
                        <ChevronDown size={15} className={`row-expand-icon ${expandido ? "is-open" : ""}`} />
                    </button>
                </td>
                <td><code>{ticket.number}</code></td>
                <td className="zammad-titulo">{ticket.title || "Sem título"}</td>
                <td>{formatData(ticket.created_at)}</td>
                <td>
                    <span className={classeEstado(ticket.state)}>{labelEstado(ticket.state)}</span>
                </td>
                <td>{ticket.group || "-"}</td>
            </tr>

            {expandido && (
                <tr className="row-expand-detail">
                    <td colSpan={6}>
                        <div className="row-expand-content">
                            <div className="zammad-detalhes-grid">
                                <DetalheCampo label="Tipo" valor={ticket.type} />
                                <DetalheCampo label="Plataforma" valor={ticket.plataforma} />
                                <DetalheCampo label="Pedido Marketplace" valor={ticket.numeropedido} />
                                <DetalheCampo label="NFD" valor={ticket.nfd} />
                                <DetalheCampo label="Valor" valor={ticket.valor} />
                                <DetalheCampo label="Data Coleta" valor={ticket.data_coleta} />
                                <DetalheCampo label="Data Devolução" valor={ticket.data_devolucao} />
                                <DetalheCampo label="Requer Autorização" valor={ticket.requer_autorizacao} />
                                <DetalheCampo label="Autorização Gestor" valor={ticket.autorizacaogestor} />
                                <DetalheCampo
                                    label="Árvore de Atendimento"
                                    valor={ticket.arvoreatendimento || ticket.novaarvoredeatendimento}
                                />
                                <DetalheCampo label="Cliente (login)" valor={ticket.customer} />
                                <DetalheCampo label="Responsável" valor={ticket.owner} />
                                <DetalheCampo label="Prioridade" valor={ticket.priority} />
                                <DetalheCampo label="Última atualização" valor={formatDataHora(ticket.updated_at)} />
                            </div>

                            <div className="zammad-conversa">
                                <span className="row-expand-title">
                                    <MessageSquare size={13} /> Conversa
                                </span>

                                {carregando && (
                                    <div className="zammad-conversa-carregando">
                                        <span className="zammad-spinner" />
                                        Carregando conversa...
                                    </div>
                                )}

                                {erro && <p className="row-expand-empty">{erro}</p>}

                                {!carregando && !erro && artigos?.length === 0 && (
                                    <p className="row-expand-empty">Nenhuma mensagem encontrada nesse ticket.</p>
                                )}

                                {!carregando && artigos?.length > 0 && (
                                    <div className="zammad-artigos-lista">
                                        {artigos.map((artigo) => (
                                            <ArtigoTicket key={artigo.id} artigo={artigo} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </Fragment>
    );
}

function TicketsZammad({ tickets = [] }) {
    return (
        <section className="zammad-section">
            <div className="section-header">
                <div className="section-title-group">
                    <Ticket size={20} />
                    <h2>Tickets do Zammad</h2>
                </div>
                <span className="info-complementar-contagem">{tickets.length}</span>
            </div>

            <div className="zammad-card">
                {tickets.length === 0 ? (
                    <div className="info-complementar-vazio">
                        <Inbox size={22} />
                        <p>Nenhum ticket encontrado</p>
                    </div>
                ) : (
                    <div className="info-complementar-tabela-wrapper">
                        <table className="info-complementar-tabela zammad-tabela">
                            <thead>
                                <tr>
                                    <th className="col-expand"></th>
                                    <th>Ticket</th>
                                    <th>Título</th>
                                    <th>Data</th>
                                    <th>Status</th>
                                    <th>Grupo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tickets.map((ticket) => (
                                    <TicketRow key={ticket.id} ticket={ticket} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </section>
    );
}

export default TicketsZammad;
