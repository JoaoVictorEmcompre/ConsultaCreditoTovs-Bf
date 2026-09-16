import { TIPOS_ENCARGO, LABELS_ENCARGO, ORDEM_ENCARGOS } from "../../constants/encargos.js";
import { LuPlus as Plus } from "react-icons/lu";
import "./MenuAdicionarEncargo.css";

export default function MenuAdicionarEncargo({ encargosAdicionados, onAdicionar, aberto, onToggle }) {
  const encargosDisponiveis = ORDEM_ENCARGOS.filter(
    tipo => !encargosAdicionados.includes(tipo)
  );

  if (encargosDisponiveis.length === 0) {
    return null;
  }

  return (
    <div className="menu-adicionar-encargo">
      <button
        type="button"
        className="btn-adicionar-encargo"
        onClick={onToggle}
      >
        <Plus size={18} />
        <span>Adicionar Encargo</span>
      </button>

      {aberto && (
        <div className="menu-opcoes">
          {encargosDisponiveis.map(tipo => (
            <button
              key={tipo}
              type="button"
              className="opcao-encargo"
              onClick={() => {
                onAdicionar(tipo);
                onToggle();
              }}
            >
              {LABELS_ENCARGO[tipo]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
