import "./SectionCollapseButton.css";
import {LuChevronDown as ChevronDown} from "react-icons/lu";

function SectionCollapseButton({colapsado, onClick, label}) {
    return (
        <button
            type="button"
            className="section-collapse-btn"
            onClick={onClick}
            aria-expanded={!colapsado}
            aria-label={colapsado ? `Expandir ${label}` : `Recolher ${label}`}
            title={colapsado ? "Expandir" : "Recolher"}
        >
            <ChevronDown size={18} className={`section-collapse-icon ${colapsado ? "is-collapsed" : ""}`}/>
        </button>
    );
}

export default SectionCollapseButton;
