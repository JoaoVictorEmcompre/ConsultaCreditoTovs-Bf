import {LuX as X} from "react-icons/lu";
import {LABELS_ENCARGO, ehJuros, ehValorMonetario, ehQuantidade} from "../../constants/encargos.js";
import "./CampoEncargo.css";

export default function CampoEncargo({encargo, onAtualizar, onRemover}) {
    const label = LABELS_ENCARGO[encargo.tipo];
    const isJuros = ehJuros(encargo.tipo);
    const isMonetario = ehValorMonetario(encargo.tipo);
    const isQuantitativo = ehQuantidade(encargo.tipo);

    const simboloCorreto = isJuros ? "%" : isMonetario ? "R$" : isQuantitativo ? "Qtd" : "%";

    const handleValorChange = (e) => {
        const valor = parseFloat(e.target.value) || 0;
        onAtualizar(encargo.id, "valor", valor);
    };

    const handleCompostoSimples = (e) => {
        onAtualizar(encargo.id, "compostoSimples", e.target.value);
    };

    return (<div className="campo-encargo">
            <div className="campo-encargo-content">
                <div className="campo-encargo-input-group">
                    <div className="campo-encargo-input-wrapper">
                        <input
                            type="number"
                            className="campo-encargo-input"
                            value={encargo.valor}
                            onChange={handleValorChange}
                            step={isMonetario ? "0.01" : "1"}
                            min="0"
                            placeholder="0"
                        />
                        <span className="campo-encargo-symbol">
              {simboloCorreto}
            </span>
                    </div>

                    {isJuros && (<select
                            className="campo-encargo-select"
                            value={encargo.compostoSimples || "simples"}
                            onChange={handleCompostoSimples}
                        >
                            <option value="simples">Simples</option>
                            <option value="composto">Composto</option>
                        </select>)}
                </div>

                <p className="campo-encargo-label">{label}</p>
            </div>

            <button
                type="button"
                className="campo-encargo-remover"
                onClick={() => onRemover(encargo.id)}
                title="Remover"
            >
                <X size={18}/>
            </button>
        </div>);
}