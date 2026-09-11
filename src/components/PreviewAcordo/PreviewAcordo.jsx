import {useState, useEffect} from "react";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import mammoth from "mammoth";
import "./PreviewAcordo.css";
import {HiOutlineExclamationCircle} from "react-icons/hi2";
import DOMPurify from "dompurify"
import {MdDescription, MdFolder, MdClose} from "react-icons/md";
import {LiaFileDownloadSolid} from "react-icons/lia";

function PreviewAcordo({aberto, onFechar, docBuffer, dadosBase, onGerarArquivo, gerando}) {
    const titulo = "Prévia — Confissão de Dívida";
    const [previewHtml, setPreviewHtml] = useState("");
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState(null);

    useEffect(() => {
        if (!aberto || !docBuffer) return;

        let cancelado = false;

        const gerarPreview = async () => {
            setCarregando(true);
            setErro(null);
            setPreviewHtml("");

            try {
                const zip = new PizZip(docBuffer);
                const doc = new Docxtemplater(zip, {
                    paragraphLoop: true,
                    linebreaks: true,
                });

                doc.render(dadosBase);

                const arrayBufferGerado = doc.getZip().generate({
                    type: "arraybuffer",
                });

                const resultado = await mammoth.convertToHtml(
                    {arrayBuffer: arrayBufferGerado},
                    {
                        includeDefaultStyleMap: true,
                    }
                );

                if (cancelado) return;

                const htmlFinal = resultado.value?.trim();

                if (!htmlFinal) {
                    setPreviewHtml("<p>Documento vazio</p>");
                } else {
                    setPreviewHtml(htmlFinal);
                }

                if (resultado.messages?.length) {
                    console.warn("Avisos do Mammoth:", resultado.messages);
                }
            } catch (renderErro) {
                if (cancelado) return;

                const msg =
                    renderErro.message?.includes("paragraph") ||
                    renderErro.message?.includes("tag")
                        ? "Erro ao renderizar a prévia. Verifique o template."
                        : renderErro.message || "Erro ao gerar prévia.";

                setErro(msg);
                setPreviewHtml("");
            } finally {
                if (!cancelado) {
                    setCarregando(false);
                }
            }
        };

        gerarPreview();

        return () => {
            cancelado = true;
        };
    }, [aberto, docBuffer, dadosBase]);

    if (!aberto) return null;

    return (
        <div className="preview-overlay" onClick={onFechar}>
            <div className="preview-modal" onClick={(e) => e.stopPropagation()}>

                <div className="preview-header">
                    <div className="preview-header-titulo">
                        <MdFolder size={24}/>
                        <span>{titulo}</span>
                        {!carregando && previewHtml && (
                            <span className="preview-badge-ok">Documento gerado</span>
                        )}
                    </div>
                    <button
                        type="button"
                        className="preview-fechar-btn"
                        onClick={onFechar}
                        aria-label="Fechar prévia"
                    >
                        <MdClose size={24}/>
                    </button>
                </div>

                <div className="preview-body">
                    {carregando ? (
                        <div className="preview-loading">
                            <div className="preview-spinner"/>
                            <span>Gerando prévia do documento...</span>
                        </div>
                    ) : erro ? (
                        <div className="preview-erro">
                            <HiOutlineExclamationCircle size={20}/>
                            <p>
                                <strong>Erro:</strong> {erro}
                            </p>
                        </div>
                    ) : previewHtml ? (
                        <div className="preview-papel">
                            <div
                                className="preview-conteudo mammoth-preview"
                                dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(previewHtml)}}
                            />
                        </div>
                    ) : (
                        <div className="preview-vazio-doc">
                            <p>Nenhuma prévia disponível</p>
                        </div>
                    )}
                </div>

                <div className="preview-footer">
                    <button type="button" className="btn-cancelar" onClick={onFechar}>
                        Fechar
                    </button>
                    {onGerarArquivo && (
                        <button
                            type="button"
                            className="btn-gerar"
                            disabled={!previewHtml || carregando}
                            onClick={onGerarArquivo}
                        >
                            <LiaFileDownloadSolid size={24}/>
                            {gerando ? "Gerando..." : "Baixar .docx"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PreviewAcordo;