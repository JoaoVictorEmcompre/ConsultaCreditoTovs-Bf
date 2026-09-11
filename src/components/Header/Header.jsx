import {useEffect, useRef, useState} from "react";
import "./Header.css";
import logo from "../../assets/logobranca-bf.png";
import {BRANCH_CODES} from "../../constants/branches.js";
import {HiOutlineChevronDown} from "react-icons/hi2";

function Header({onSearch, redeInterna, cnpjInicial = ""}) {
    const [cnpj, setCnpj] = useState(cnpjInicial);
    const [branchCode, setBranchCode] = useState("");
    const [isBranchOpen, setIsBranchOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const branchRef = useRef(null);

    useEffect(() => {
        setCnpj(cnpjInicial);
    }, [cnpjInicial]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (branchRef.current && !branchRef.current.contains(event.target)) {
                setIsBranchOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedBranch = BRANCH_CODES.find((branch) => branch.value === branchCode);

    const handleSelectBranch = (value) => {
        setBranchCode(value);
        setIsBranchOpen(false);
    };

    const handleSearch = async () => {
        if (!cnpj.trim() || !branchCode) return;

        setLoading(true);
        try {
            await onSearch(cnpj, branchCode);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    };

    return (
        <header className="header">
            <div className="header-content">
                <div className="header-brand">
                    <div className="header-icon">
                        <img src={logo} alt="Logo BF" className="header-logo" width="60" height="60"/>
                    </div>

                    <div>
                        <h1 className="header-title">Consulta Crédito</h1>
                        <p className="header-subtitle">
                            Gestão de crédito e análise financeira
                        </p>
                    </div>
                </div>

                {redeInterna && (
                    <div className="header-search">
                        <div className="branch-select-container" ref={branchRef}>
                            <button
                                type="button"
                                className={`branch-select-trigger ${!selectedBranch ? "is-placeholder" : ""}`}
                                onClick={() => setIsBranchOpen((open) => !open)}
                                disabled={loading}
                            >
                                <span>{selectedBranch ? selectedBranch.label : "Filial"}</span>
                                <HiOutlineChevronDown
                                    size={16}
                                    className={`branch-select-chevron ${isBranchOpen ? "is-open" : ""}`}
                                />
                            </button>

                            {isBranchOpen && (
                                <div className="branch-select-dropdown">
                                    {BRANCH_CODES.map((branch) => (
                                        <button
                                            type="button"
                                            key={branch.value}
                                            className={`branch-select-option ${branch.value === branchCode ? "is-selected" : ""}`}
                                            onClick={() => handleSelectBranch(branch.value)}
                                        >
                                            {branch.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="search-input-wrapper">
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Digite o CNPJ"
                                value={cnpj}
                                onChange={(e) => setCnpj(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={loading}
                            />
                        </div>

                        <button
                            className="search-button"
                            onClick={handleSearch}
                            disabled={loading || !branchCode}
                        >
                            {loading ? "Buscando..." : "Buscar"}
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}

export default Header;
