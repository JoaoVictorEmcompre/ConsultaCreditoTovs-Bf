import { Fragment, useEffect, useState } from "react";
import "./TicketsZammad.css";
import { LuTicket as Ticket, LuChevronDown as ChevronDown, LuMessageSquare as MessageSquare, LuLock as Lock, LuPaperclip as Paperclip, LuDownload as Download, LuX as X, LuFileText as FileText, LuImage as ImageIcon } from "react-icons/lu";
import { getZammadTicketArticles, getZammadAttachmentUrl } from "../../services/zammad.js";
import EmptyState from "../common/EmptyState.jsx";
import SectionCollapseButton from "../common/SectionCollapseButton.jsx";

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

function formatTamanho(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const EXT_IMAGEM = /\.(png|jpe?g|gif|webp)$/i;
const EXT_PDF = /\.pdf$/i;

// Só imagem e PDF têm prévia (o proxy também só serve esses tipos inline).
function tipoPreview(anexo) {
    const mime = String(anexo.preferences?.["Content-Type"] || "").toLowerCase();
    const nome = anexo.filename || "";
    if (mime === "application/pdf" || EXT_PDF.test(nome)) return "pdf";
    if (/^image\/(png|jpe?g|gif|webp)$/.test(mime) || EXT_IMAGEM.test(nome)) return "imagem";
    return null;
}

function PreviewAnexo({ anexo, tipo, urlPreview, urlDownload, onFechar }) {
    useEffect(() => {
        const aoTeclar = (e) => e.key === "Escape" && onFechar();
        document.addEventListener("keydown", aoTeclar);
        return () => document.removeEventListener("keydown", aoTeclar);
    }, [onFechar]);

    return (
        <div className="zammad-preview-overlay" onClick={onFechar}>
            <div
                className="zammad-preview-modal"
                role="dialog"
                aria-label={`Prévia de ${anexo.filename}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="zammad-preview-header">
                    <span className="zammad-preview-icone">
                        {tipo === "pdf" ? <FileText size={20} /> : <ImageIcon size={20} />}
                    </span>
                    <div className="zammad-preview-info">
                        <span className="zammad-preview-titulo" title={anexo.filename}>{anexo.filename}</span>
                        <span className="zammad-preview-meta">
                            {[tipo === "pdf" ? "PDF" : "Imagem", formatTamanho(anexo.size)].filter(Boolean).join(" · ")}
                        </span>
                    </div>
                    <a className="zammad-preview-baixar" href={urlDownload} download={anexo.filename}>
                        <Download size={16} /> Baixar arquivo
                    </a>
                    <button type="button" className="zammad-preview-fechar" onClick={onFechar} aria-label="Fechar prévia">
                        <X size={16} />
                    </button>
                </div>
                <div className="zammad-preview-corpo">
                    {tipo === "pdf" ? (
                        <iframe title={anexo.filename} src={urlPreview} className="zammad-preview-pdf" />
                    ) : (
                        <img src={urlPreview} alt={anexo.filename} className="zammad-preview-imagem" />
                    )}
                </div>
            </div>
        </div>
    );
}

function ArtigoTicket({ artigo, ticketId, cpfCnpj }) {
    const texto = htmlParaTexto(artigo.body);
    const anexos = Array.isArray(artigo.attachments) ? artigo.attachments : [];
    const [anexoAberto, setAnexoAberto] = useState(null);

    const urlDe = (anexo, inline) =>
        getZammadAttachmentUrl(ticketId, artigo.id, anexo.id, cpfCnpj, { inline });
    const tipoAberto = anexoAberto ? tipoPreview(anexoAberto) : null;

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
            {anexos.length > 0 && (
                <div className="zammad-anexos">
                    {anexos.map((anexo) => {
                        const conteudo = (
                            <>
                                <Paperclip size={12} />
                                <span className="zammad-anexo-nome">{anexo.filename || `anexo-${anexo.id}`}</span>
                                {formatTamanho(anexo.size) && (
                                    <span className="zammad-anexo-tamanho">{formatTamanho(anexo.size)}</span>
                                )}
                            </>
                        );

                        // Com prévia: abre o modal. Sem prévia: baixa direto.
                        return tipoPreview(anexo) ? (
                            <button
                                key={anexo.id}
                                type="button"
                                className="zammad-anexo"
                                onClick={() => setAnexoAberto(anexo)}
                            >
                                {conteudo}
                            </button>
                        ) : (
                            <a
                                key={anexo.id}
                                className="zammad-anexo"
                                href={urlDe(anexo, false)}
                                download={anexo.filename}
                            >
                                {conteudo}
                            </a>
                        );
                    })}
                </div>
            )}
            {anexoAberto && (
                <PreviewAnexo
                    anexo={anexoAberto}
                    tipo={tipoAberto}
                    urlPreview={urlDe(anexoAberto, true)}
                    urlDownload={urlDe(anexoAberto, false)}
                    onFechar={() => setAnexoAberto(null)}
                />
            )}
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
                                            <ArtigoTicket
                                                key={artigo.id}
                                                artigo={artigo}
                                                ticketId={ticket.id}
                                                cpfCnpj={ticket.customer}
                                            />
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
    const [colapsado, setColapsado] = useState(false);

    return (
        <section className="zammad-section">
            <div className="section-header">
                <div className="section-title-group">
                    <Ticket size={20} />
                    <h2>Tickets do Zammad</h2>
                </div>
                <div className="section-header-actions">
                    <span className="info-complementar-contagem">{tickets.length}</span>
                    <SectionCollapseButton
                        colapsado={colapsado}
                        onClick={() => setColapsado((v) => !v)}
                        label="Tickets do Zammad"
                    />
                </div>
            </div>

            {!colapsado && (
            <div className="zammad-card">
                {tickets.length === 0 ? (
                    <EmptyState
                        icon={Ticket}
                        title="Nenhum ticket encontrado"
                        subtitle="Esse cliente ainda não abriu chamados no Zammad."
                    />
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
            )}
        </section>
    );
}

export default TicketsZammad;
