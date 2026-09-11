import {useState} from "react";
import "./PainelAcao.css";
import {HiOutlineArchiveBox, HiOutlinePencilSquare} from "react-icons/hi2";
import {FaPhoneAlt, FaWhatsapp} from "react-icons/fa";
import {MdEast} from "react-icons/md";

function PainelAcao({onRegistrar}) {
    const [registro, setRegistro] = useState({
        tipo: "Ligação",
        resultado: "",
        observacao: "",
        dataPagamento: "",
        tipoAcordo: "",
        parcelas: 1,
    });

    const handleChange = (field, value) => {
        setRegistro((prev) => {
            const updated = {...prev, [field]: value};
            if (field === "resultado" && value !== "Promessa de Pagamento" && value !== "Acordo Realizado") {
                updated.dataPagamento = "";
                updated.tipoAcordo = "";
                updated.parcelas = 1;
            }
            if (field === "tipoAcordo" && value !== "Parcelamento") {
                updated.parcelas = 1;
            }
            return updated;
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!registro.resultado) return;
        if (onRegistrar) {
            onRegistrar(registro);
        }
        setRegistro({
            tipo: "Ligação",
            resultado: "",
            observacao: "",
            dataPagamento: "",
            tipoAcordo: "",
            parcelas: 1,
        });
    };

    const mostrarCamposAcordo =
        registro.resultado === "Promessa de Pagamento" || registro.resultado === "Acordo Realizado";

    return (
        <section className="painel-section">
            <div className="section-header">
                <div className="section-title-group">
                    <HiOutlinePencilSquare size={20}/>
                    <h2>Registrar Cobran&ccedil;a</h2>
                </div>
            </div>

            <div className="painel-card">
                <form onSubmit={handleSubmit}>
                    <div className="painel-form-grid">
                        <div className="form-group">
                            <label className="form-label">Canal de Contato</label>
                            <div className="canal-options">
                                {["Ligação", "WhatsApp", "E-mail"].map((canal) => (
                                    <button
                                        key={canal}
                                        type="button"
                                        className={`canal-btn ${registro.tipo === canal ? "canal-btn-active" : ""}`}
                                        onClick={() => handleChange("tipo", canal)}
                                    >
                                        {canal === "Ligação" && (
                                            <FaPhoneAlt size={20}/>
                                        )}
                                        {canal === "WhatsApp" && (
                                            <FaWhatsapp size={20}/>
                                        )}
                                        {canal === "E-mail" && (
                                            <MdEast size={20}/>
                                        )}
                                        {canal}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="resultado">Resultado do Contato</label>
                            <select
                                id="resultado"
                                className="form-select"
                                value={registro.resultado}
                                onChange={(e) => handleChange("resultado", e.target.value)}
                            >
                                <option value="" disabled>Selecione o resultado...</option>
                                <option value="Contato Realizado">Contato Realizado</option>
                                <option value="Não Atendeu">N&atilde;o Atendeu</option>
                                <option value="Promessa de Pagamento">Promessa de Pagamento</option>
                                <option value="Acordo Realizado">Acordo Realizado</option>
                                <option value="Recusa de Pagamento">Recusa de Pagamento</option>
                                <option value="Número Inexistente">N&uacute;mero Inexistente</option>
                            </select>
                        </div>

                        {mostrarCamposAcordo && (
                            <>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="dataPagamento">Data Prevista de
                                        Pagamento</label>
                                    <input
                                        id="dataPagamento"
                                        type="date"
                                        className="form-input"
                                        value={registro.dataPagamento}
                                        onChange={(e) => handleChange("dataPagamento", e.target.value)}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label" htmlFor="tipoAcordo">Tipo de Acordo</label>
                                    <select
                                        id="tipoAcordo"
                                        className="form-select"
                                        value={registro.tipoAcordo}
                                        onChange={(e) => handleChange("tipoAcordo", e.target.value)}
                                    >
                                        <option value="" disabled>Selecione o tipo...</option>
                                        <option value="Quitação">Quita&ccedil;&atilde;o (Pagamento &Agrave; Vista)
                                        </option>
                                        <option value="Parcelamento">Parcelamento</option>
                                        <option value="Renegociação">Renegocia&ccedil;&atilde;o de D&iacute;vida
                                        </option>
                                    </select>
                                </div>

                                {registro.tipoAcordo === "Parcelamento" && (
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="parcelas">N&uacute;mero de
                                            Parcelas</label>
                                        <select
                                            id="parcelas"
                                            className="form-select"
                                            value={registro.parcelas}
                                            onChange={(e) => handleChange("parcelas", Number(e.target.value))}
                                        >
                                            {[2, 3, 4, 5, 6].map((n) => (
                                                <option key={n} value={n}>{n}x</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="form-group form-group-full">
                        <label className="form-label" htmlFor="observacao">Observa&ccedil;&otilde;es</label>
                        <textarea
                            id="observacao"
                            className="form-textarea"
                            rows="3"
                            placeholder="Descreva o que foi conversado com o cliente..."
                            value={registro.observacao}
                            onChange={(e) => handleChange("observacao", e.target.value)}
                        />
                    </div>

                    <div className="painel-actions">
                        <button
                            type="submit"
                            className="btn-registrar"
                            disabled={!registro.resultado}
                        >
                            <HiOutlineArchiveBox size={20}/>
                            Registrar Cobrança
                        </button>
                    </div>
                </form>
            </div>
        </section>
    );
}

export default PainelAcao;
