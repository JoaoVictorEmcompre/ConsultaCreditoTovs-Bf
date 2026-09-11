import {useEffect, useState, useCallback} from "react";
import {useNavigate, useSearchParams} from "react-router-dom";
import Header from "../../components/Header/Header.jsx";
import InformacoesCadastrais from "../../components/InformacoesCadastrais/InformacoesCadastrais.jsx";
import SituacaoFinanceira from "../../components/SituacaoFinanceira/SituacaoFinanceira.jsx";
import ResumoCredito from "../../components/ResumoCredito/ResumoCredito.jsx";
import SimuladorNegociacao from "../../components/SimuladorNegociacao/SimuladorNegociacao.jsx";
import AcordoCredito from "../../components/AcordoCredito/AcordoCredito.jsx";
import {searchLegalEntities, searchIndividuals, searchPersonByCode, searchCustomerFinancialBalance, searchDocuments} from "../../services/totvs.js";
import {mapLegalEntityToDadosCadastrais, mapFinancialBalanceToResumoCredito, mapDocumentsToDuplicatas} from "../../services/dataMapper.js";
import {pegarIP} from "../../services/pegarIP.js";
import {isValidPermanentLogin, updateLastAccessDate, clearPermanentLogin} from "../../services/authService.js";
import {DEFAULT_EXTERNAL_BRANCH_CODE} from "../../constants/branches.js";
import "./ConsultaCredito.css";

function limparCnpj(valor = "") {
    return valor.replace(/\D/g, "");
}

function detectarCriterioBusca(valorLimpo) {
    if (valorLimpo.length === 11) return {tipo: "cpf", valor: valorLimpo};
    if (valorLimpo.length === 14) return {tipo: "cnpj", valor: valorLimpo};
    if (valorLimpo.length > 0) return {tipo: "codigo", valor: valorLimpo};
    return null;
}

function decodeBase64Url(valor = "") {
    try {
        let base64 = valor
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        while (base64.length % 4 !== 0) {
            base64 += "=";
        }

        return atob(base64);
    } catch {
        return "";
    }
}

function decodeCnpj(k = "") {
    const decoded = decodeBase64Url(k);
    const clean = limparCnpj(decoded);
    return clean.length === 11 || clean.length === 14 ? clean : "";
}

function ConsultaCredito() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const kParam = searchParams.get("k") || "";

    const [simuladorAberto, setSimuladorAberto] = useState(false);
    const [acordoAberto, setAcordoAberto] = useState(false);
    const [currentDadosCadastrais, setCurrentDadosCadastrais] = useState(null);
    const [currentDuplicatas, setCurrentDuplicatas] = useState([]);
    const [currentResumoCredito, setCurrentResumoCredito] = useState(null);
    const [error, setError] = useState(null);
    const [searching, setSearching] = useState(false);
    const [validandoAcesso, setValidandoAcesso] = useState(true);
    const [isRedeInterna, setIsRedeInterna] = useState(false);
    const [kExterno, setKExterno] = useState("");

    const handleSearch = useCallback(async (cnpj, branchCode = DEFAULT_EXTERNAL_BRANCH_CODE) => {
        setSearching(true);
        setError(null);

        try {
            const cleanCnpj = limparCnpj(cnpj);
            const criterio = detectarCriterioBusca(cleanCnpj);

            if (!criterio) {
                setError("Informe um CNPJ, CPF ou código do cliente válido.");
                setCurrentDadosCadastrais(null);
                setCurrentResumoCredito(null);
                setCurrentDuplicatas([]);
                return;
            }

            const searchPerson = criterio.tipo === "cpf"
                ? searchIndividuals(criterio.valor)
                : criterio.tipo === "cnpj"
                    ? searchLegalEntities(criterio.valor)
                    : searchPersonByCode(criterio.valor);

            const criterioCliente = criterio.tipo === "codigo"
                ? {tipo: "codigo", valor: criterio.valor}
                : {tipo: "documento", valor: criterio.valor};

            const [legalEntityData, financialData, documentsData] = await Promise.all([
                searchPerson,
                searchCustomerFinancialBalance(criterioCliente, branchCode),
                searchDocuments(criterioCliente, branchCode),
            ]);

            if (legalEntityData.items?.length > 0) {
                const mappedDados = await mapLegalEntityToDadosCadastrais(legalEntityData.items[0]);
                setCurrentDadosCadastrais(mappedDados);
            } else {
                setCurrentDadosCadastrais(null);
            }

            if (financialData.items?.length > 0) {
                const mappedResumo = mapFinancialBalanceToResumoCredito(financialData, documentsData);
                setCurrentResumoCredito(mappedResumo);
            } else {
                setCurrentResumoCredito(null);
            }

            if (documentsData.items?.length > 0) {
                const mappedDuplicatas = mapDocumentsToDuplicatas(documentsData);
                setCurrentDuplicatas(mappedDuplicatas);
            } else {
                setCurrentDuplicatas([]);
            }
        } catch (err) {
            setError(err.message || "Erro ao buscar dados. Verifique o CNPJ e tente novamente.");
            setCurrentDadosCadastrais(null);
            setCurrentResumoCredito(null);
            setCurrentDuplicatas([]);
        } finally {
            setSearching(false);
        }
    }, []);

    useEffect(() => {
        const login = sessionStorage.getItem("usuario-logado") === "true";

        async function validarAcesso() {
            try {
                const ipUser = await pegarIP();

                const IPS_INTERNOS = (import.meta.env.VITE_IPS_INTERNOS || "")
                    .split(",")
                    .map((ip) => ip.trim())
                    .filter(Boolean);

                const ehInterno = IPS_INTERNOS.includes(ipUser);

                setIsRedeInterna(ehInterno);
                sessionStorage.setItem("ip-interno", ehInterno ? "true" : "false");

                if (ehInterno) {
                    if (!login) {
                        if (isValidPermanentLogin()) {
                            sessionStorage.setItem("usuario-logado", "true");
                            updateLastAccessDate();
                            setValidandoAcesso(false);
                            return;
                        } else {
                            clearPermanentLogin();
                            navigate("/login", {replace: true});
                            return;
                        }
                    }

                    setValidandoAcesso(false);
                    return;
                }

                const kDaUrl = kParam.trim();
                const kSalvo = (sessionStorage.getItem("externo-k") || "").trim();
                const kFinal = kDaUrl || kSalvo;

                const cnpjDecodificado = decodeCnpj(kFinal);

                if (!kFinal || !cnpjDecodificado) {
                    setError("Acesso externo inválido. Parâmetro ausente ou inválido.");
                    setValidandoAcesso(false);
                    return;
                }

                setKExterno(kFinal);
                sessionStorage.setItem("externo-k", kFinal);

                if (kDaUrl) {
                    window.history.replaceState({}, "", import.meta.env.BASE_URL);
                }
            } catch (err) {
                console.error("Erro ao validar acesso:", err);
                setError("Não foi possível validar o acesso.");
            } finally {
                setValidandoAcesso(false);
            }
        }

        validarAcesso();
    }, [navigate, kParam]);

    useEffect(() => {
        if (validandoAcesso) return;
        if (isRedeInterna) return;
        if (!kExterno) return;

        const cnpjDecodificado = decodeCnpj(kExterno);

        if (cnpjDecodificado) {
            handleSearch(cnpjDecodificado);
        } else {
            setError("Não foi possível interpretar o acesso externo.");
        }
    }, [validandoAcesso, isRedeInterna, kExterno, handleSearch]);

    if (validandoAcesso) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="consulta-page">
            <Header
                onSearch={handleSearch}
                redeInterna={isRedeInterna}
                cnpjInicial=""
            />

            <main className="consulta-content">
                {error && (
                    <div className="error-banner">
                        <p>{error}</p>
                    </div>
                )}

                {searching && (
                    <div className="loading-banner">
                        <p>Carregando dados...</p>
                    </div>
                )}

                <InformacoesCadastrais
                    dados={currentDadosCadastrais}
                    onAbrirSimulador={() => setSimuladorAberto(true)}
                    onAbrirAcordo={() => setAcordoAberto(true)}
                    ipInterno={isRedeInterna}
                />

                <ResumoCredito resumo={currentResumoCredito}/>
                <SituacaoFinanceira duplicatas={currentDuplicatas}/>
            </main>

            <SimuladorNegociacao
                duplicatas={currentDuplicatas}
                aberto={simuladorAberto}
                onFechar={() => setSimuladorAberto(false)}
            />

            {isRedeInterna && (
                <AcordoCredito
                    duplicatas={currentDuplicatas}
                    dadosCadastrais={currentDadosCadastrais}
                    aberto={acordoAberto}
                    onFechar={() => setAcordoAberto(false)}
                />
            )}

        </div>
    );
}

export default ConsultaCredito;
