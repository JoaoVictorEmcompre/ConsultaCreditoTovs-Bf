import {useState, useMemo, useEffect} from "react";
import {useModelos} from "../../context/useModelos.js";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import PreviewAcordo from "../PreviewAcordo/PreviewAcordo.jsx";
import {mapDuplicatasParaTabela, formatValorExtenso, formatNumeroExtensoFeminino, buildInitialPartes, mapPartesToTemplateVariables} from "../../services/dataMapper.js";
import {calcularSimulacaoComEncargos, obterEncargosParaDocumento} from "../../services/encargosCalculos.js";
import {VALORES_PADRAO, LABELS_ENCARGO, CAMPOS_FIXOS} from "../../constants/encargos.js";
import CampoEncargo from "./CampoEncargo.jsx";
import MenuAdicionarEncargo from "./MenuAdicionarEncargo.jsx";
import "./AcordoCredito.css";
import EmptyState from "../common/EmptyState.jsx";
import {LuFileText as FileText, LuX as X, LuChevronUp as ChevronUp, LuChevronDown as ChevronDown, LuChevronRight as ChevronRight} from "react-icons/lu";

function formatCurrency(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

function aplicarMascara(campo, valor) {
    let v = String(valor || "").replace(/\D/g, "");

    if (campo === "cpf") {
        return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4").slice(0, 14);
    }

    if (campo === "cnpj") {
        return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5").slice(0, 18);
    }

    if (campo === "cep") {
        return v.replace(/(\d{5})(\d{3})/, "$1-$2").slice(0, 9);
    }

    if (campo === "rg") {
        return v.slice(0, 20);
    }

    return valor;
}

function validarCPF(cpf) {
    const clean = String(cpf || "").replace(/\D/g, "");

    if (clean.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(clean)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i++) {
        soma += Number(clean.charAt(i)) * (10 - i);
    }

    let resto = 11 - (soma % 11);
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== Number(clean.charAt(9))) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) {
        soma += Number(clean.charAt(i)) * (11 - i);
    }

    resto = 11 - (soma % 11);
    if (resto === 10 || resto === 11) resto = 0;

    return resto === Number(clean.charAt(10));
}

async function buscarCepViaCep(cep) {
    const cleanCep = String(cep || "").replace(/\D/g, "");

    if (cleanCep.length !== 8) return null;

    try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();

        if (!data || data.erro) return null;
        return data;
    } catch {
        return null;
    }
}

function generateUUID() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function criarEncargosPadrao() {
    return CAMPOS_FIXOS.map(tipo => ({
        id: generateUUID(),
        tipo,
        valor: VALORES_PADRAO[tipo].valor,
        compostoSimples: VALORES_PADRAO[tipo].compostoSimples,
        ativo: true
    }));
}

function AcordoCredito({duplicatas, dadosCadastrais, aberto, onFechar}) {
    const {listarModelos, obterModelo} = useModelos();
    const modelos = listarModelos();

    const [selecionadas, setSelecionadas] = useState([]);
    const [tipoAcordo, setTipoAcordo] = useState("avista");
    const [parcelas, setParcelas] = useState(2);
    const [encargos, setEncargos] = useState(() => criarEncargosPadrao());
    const [menuEncargosAberto, setMenuEncargosAberto] = useState(false);
    const [tipoArquivo, setTipoArquivo] = useState("");
    const [gerando, setGerando] = useState(false);
    const [previewAberto, setPreviewAberto] = useState(false);
    const [dataPagamentoManual, setDataPagamentoManual] = useState("");

    const [partes, setPartes] = useState(() => buildInitialPartes(dadosCadastrais));
    const [blocosAbertos, setBlocosAbertos] = useState({
        notificado: false,
        socio: false,
        avalista: false,
        devedorSolidario: false,
    });

    const duplicatasVencidas = duplicatas.filter(
        (d) => d.statusPagamento !== "Pago com Atraso" && d.statusPagamento !== "Pago"
    );

    useEffect(() => {
        if (modelos.length > 0 && !tipoArquivo) {
            setTipoArquivo(modelos[0].nome);
        }
    }, [modelos, tipoArquivo]);

    useEffect(() => {
        setPartes(buildInitialPartes(dadosCadastrais));
    }, [dadosCadastrais]);

    const toggleSelecao = (id) => {
        setSelecionadas((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    };

    const toggleTodas = () => {
        if (selecionadas.length === duplicatasVencidas.length) {
            setSelecionadas([]);
        } else {
            setSelecionadas(duplicatasVencidas.map((d) => d.id));
        }
    };

    const toggleBloco = (bloco) => {
        setBlocosAbertos((prev) => ({
            ...prev,
            [bloco]: !prev[bloco],
        }));
    };

    const adicionarEncargo = (tipo) => {
        const padrao = VALORES_PADRAO[tipo];
        const novoEncargo = {
            id: generateUUID(),
            tipo,
            valor: padrao.valor,
            compostoSimples: padrao.compostoSimples,
            ativo: true
        };
        setEncargos([...encargos, novoEncargo]);
    };

    const removerEncargo = (id) => {
        setEncargos(encargos.filter(e => e.id !== id));
    };

    const atualizarEncargo = (id, campo, valor) => {
        setEncargos(encargos.map(e =>
            e.id === id ? {...e, [campo]: valor} : e
        ));
    };

    const encargosAdicionados = encargos
        .filter(e => !CAMPOS_FIXOS.includes(e.tipo))
        .map(e => e.tipo);

    const handleChangeParte = async (bloco, campo, valor) => {
        let novoValor = valor;

        if (campo === "cpf") {
            novoValor = aplicarMascara("cpf", valor);
        } else if (campo === "cnpj") {
            novoValor = aplicarMascara("cnpj", valor);
        } else if (campo === "cep") {
            novoValor = aplicarMascara("cep", valor);
        } else if (campo === "rg") {
            novoValor = aplicarMascara("rg", valor);
        }

        setPartes((prev) => ({
            ...prev,
            [bloco]: {
                ...prev[bloco],
                [campo]: novoValor,
            },
        }));

        if (
            campo === "cep" &&
            bloco !== "notificado" &&
            String(novoValor).replace(/\D/g, "").length === 8
        ) {
            const dadosEndereco = await buscarCepViaCep(novoValor);

            if (dadosEndereco) {
                setPartes((prev) => ({
                    ...prev,
                    [bloco]: {
                        ...prev[bloco],
                        cep: aplicarMascara("cep", novoValor),
                        rua: dadosEndereco.logradouro || prev[bloco].rua || "",
                        bairro: dadosEndereco.bairro || prev[bloco].bairro || "",
                        municipio: dadosEndereco.localidade || prev[bloco].municipio || "",
                        estado: dadosEndereco.uf || prev[bloco].estado || "",
                    },
                }));
            }
        }
    };

    const simulacao = useMemo(() => {
        return calcularSimulacaoComEncargos(
            duplicatasVencidas,
            selecionadas,
            encargos,
            tipoAcordo,
            parcelas
        );
    }, [
        selecionadas,
        duplicatasVencidas,
        encargos,
        tipoAcordo,
        parcelas,
    ]);

    const dadosBaseDocumento = useMemo(() => {
        if (!simulacao) return {};

        const variaveisPartes = mapPartesToTemplateVariables(partes);
        const duplicatasSelecionadas = duplicatasVencidas.filter((d) =>
            selecionadas.includes(d.id)
        );
        const totalParcelas = simulacao.entrada > 0
            ? simulacao.numParcelas + 1
            : simulacao.numParcelas;

        const dataBaseParaVencimento = dataPagamentoManual
            ? new Date(dataPagamentoManual + "T00:00:00")
            : new Date();

        let vencimentoPrimeiraParcela = dataBaseParaVencimento.toLocaleDateString("pt-BR");
        let vencimentoUltimaParcela = vencimentoPrimeiraParcela;

        if (simulacao.numParcelas > 0) {
            const dtUltima = new Date(dataBaseParaVencimento);
            const incrementoMes = simulacao.entrada > 0 ? simulacao.numParcelas : simulacao.numParcelas - 1;
            dtUltima.setMonth(dtUltima.getMonth() + incrementoMes);
            vencimentoUltimaParcela = dtUltima.toLocaleDateString("pt-BR");
        }

        const parcelasPagasValor = encargos.find(e => e.tipo === 'parcelas_pagas')?.valor || 0;
        const parcelasFaltantes = Math.max(0, totalParcelas - parcelasPagasValor);
        const encargosInfo = obterEncargosParaDocumento(encargos);

        // Gerar tabelas
        let TABELA_1 = [];
        const temEntrada = simulacao.entrada > 0;
        const totalParcelasContrato = temEntrada
            ? simulacao.numParcelas + 1
            : simulacao.numParcelas;

        if (temEntrada) {
            TABELA_1.push({
                parcelas: `1/${totalParcelasContrato}`,
                vencimento: dataBaseParaVencimento.toLocaleDateString("pt-BR"),
                valor: formatCurrency(simulacao.entrada),
            });
        }

        for (let i = 0; i < simulacao.numParcelas; i++) {
            const dt = new Date(dataBaseParaVencimento);
            const incrementoMes = temEntrada ? i + 1 : i;
            dt.setMonth(dt.getMonth() + incrementoMes);

            TABELA_1.push({
                parcelas: `${temEntrada ? i + 2 : i + 1}/${totalParcelasContrato}`,
                vencimento: dt.toLocaleDateString("pt-BR"),
                valor: formatCurrency(simulacao.valorParcela),
            });
        }

        const dataUltimaParcelaFormatada = TABELA_1[TABELA_1.length - 1].vencimento;

        const TABELA_2 = duplicatasSelecionadas.map((dup) => ({
            duplicata: dup.duplicata,
            parcela: totalParcelasContrato,
            cliente: partes.notificado.nome || dadosCadastrais.razaoSocial || "",
            valor: formatCurrency(simulacao.totalFinal),
            vencimento: dataUltimaParcelaFormatada,
        }));

        const TABELA_3 = duplicatasSelecionadas.map((dup) => ({
            duplicata: dup.duplicata,
            parcela: totalParcelasContrato,
            cliente: partes.notificado.nome || dadosCadastrais.razaoSocial || "",
            valor_duplicata: formatCurrency(dup.valor),
            data_vencimento: dataUltimaParcelaFormatada,
            valor_atualizado: formatCurrency(
                dup.valor +
                (simulacao.totalFinal - simulacao.subtotalBruto) / duplicatasSelecionadas.length
            ),
        }));

        return {
            ...variaveisPartes,
            DATA_GERACAO: new Date().toLocaleDateString("pt-BR"),
            DATA_HOJE: new Date().toLocaleDateString("pt-BR"),
            DATA_PAGAMENTO: dataPagamentoManual
                ? new Date(dataPagamentoManual + "T00:00:00").toLocaleDateString("pt-BR")
                : "",
            TOTAL_FINAL: formatCurrency(simulacao.totalFinal),
            TOTAL_FINAL_EXTENSO: formatValorExtenso(simulacao.totalFinal),
            VALOR_TOTAL: formatCurrency(simulacao.totalFinal),
            VALOR_TOTAL_EXTENSO: formatValorExtenso(simulacao.totalFinal),
            SUBTOTAL: formatCurrency(simulacao.subtotal),
            VALOR_ENTRADA: formatCurrency(simulacao.entrada),
            VALOR_ENTRADA_EXTENSO: formatValorExtenso(simulacao.entrada),
            JUROS: encargosInfo.jurosmensal,
            VALOR_JUROS: formatCurrency(simulacao.juros),
            JUROS_MORA: encargosInfo.jurosMora,
            VALOR_JUROS_MORA: formatCurrency(simulacao.jurosMora),
            MULTA: encargosInfo.multa,
            VALOR_MULTA: formatCurrency(simulacao.multa),
            HONORARIO: encargosInfo.honorarios,
            VALOR_HONORARIO: formatCurrency(simulacao.honorarios),
            NUMERO_PARCELAS: totalParcelas,
            PARCELAS: totalParcelas,
            PARCELAS_EXTENSO: formatNumeroExtensoFeminino(totalParcelas),
            VALOR_PARCELA: formatCurrency(simulacao.valorParcela),
            VALOR_PARCELA_EXTENSO: formatValorExtenso(simulacao.valorParcela),
            TIPO_ACORDO: tipoAcordo === "avista" ? "À Vista" : "Parcelado",
            TEM_ENTRADA: simulacao.entrada > 0,

            VENCIMENTO_PRIMEIRA_PARCELA: vencimentoPrimeiraParcela,
            VENCIMENTO_ULTIMA_PARCELA: vencimentoUltimaParcela,
            PARCELAS_PAGAS: parcelasPagasValor,
            PARCELAS_PAGAS_EXTENSO: formatNumeroExtensoFeminino(parcelasPagasValor),
            PARCELAS_FALTANTES: parcelasFaltantes,
            PARCELAS_FALTANTES_EXTENSO: formatNumeroExtensoFeminino(parcelasFaltantes),

            DATA_VENCIMENTO_FINAL: dataUltimaParcelaFormatada,
            TABELA_1,
            TABELA_2,
            TABELA_3,

            DUPLICATAS: mapDuplicatasParaTabela(duplicatasSelecionadas),
        };
    }, [
        simulacao,
        partes,
        dataPagamentoManual,
        encargos,
        tipoAcordo,
        duplicatasVencidas,
        selecionadas,
    ]);

    const handleSelecionarDocumento = (nome) => {
        setTipoArquivo(nome);

        if (!simulacao) {
            alert("Selecione pelo menos uma duplicata para visualizar a prévia.");
            return;
        }

        setPreviewAberto(true);
    };

    const handleGerarArquivo = async () => {
        if (!simulacao) {
            alert("Selecione pelo menos uma duplicata para gerar o acordo.");
            return;
        }

        setGerando(true);

        try {
            const docBuffer = obterModelo(tipoArquivo);

            if (!docBuffer) {
                alert("Erro: o modelo selecionado não foi carregado corretamente.");
                setGerando(false);
                return;
            }

            const duplicatasSelecionadas = duplicatasVencidas.filter((d) =>
                selecionadas.includes(d.id)
            );

            const dados = dadosBaseDocumento;

            const zip = new PizZip(docBuffer);
            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
            });

            doc.render(dados);

            const novoDocBuffer = doc.getZip().generate({
                type: "arraybuffer",
            });

            const blob = new Blob([novoDocBuffer], {
                type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `acordo_${dadosCadastrais?.cnpj || "modelo"}_${new Date().getTime()}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert("Arquivo gerado com sucesso!");
            onFechar();
        } catch (erro) {
            const mensagem =
                erro.message?.includes("paragraph") || erro.message?.includes("tag")
                    ? "Erro ao montar o documento. Verifique o template."
                    : erro.message || "Erro desconhecido";
            alert(`Erro ao gerar arquivo: ${mensagem}`);
        } finally {
            setGerando(false);
        }
    };

    const camposNotificado = [
        {key: "nome", label: "Nome / Razão Social"},
        {key: "cnpj", label: "CNPJ"},
        {key: "cep", label: "CEP"},
        {key: "rua", label: "Rua"},
        {key: "numero", label: "Número"},
        {key: "bairro", label: "Bairro"},
        {key: "municipio", label: "Município"},
        {key: "estado", label: "Estado"},
    ];

    const camposPessoaFisica = [
        {key: "nome", label: "Nome"},
        {key: "nacionalidade", label: "Nacionalidade"},
        {key: "estadoCivil", label: "Estado Civil"},
        {key: "profissao", label: "Profissão"},
        {key: "rg", label: "RG"},
        {key: "orgaoEmissor", label: "Órgão Emissor"},
        {key: "cpf", label: "CPF"},
        {key: "cep", label: "CEP"},
        {key: "rua", label: "Rua"},
        {key: "numero", label: "Número"},
        {key: "bairro", label: "Bairro"},
        {key: "municipio", label: "Município"},
        {key: "estado", label: "Estado"},
    ];

    const renderBlocoParte = (titulo, bloco, campos) => {
        const abertoBloco = blocosAbertos[bloco];

        return (
            <div className="parte-card">
                <button
                    type="button"
                    className="parte-card-header"
                    onClick={() => toggleBloco(bloco)}
                >
                    <span>{titulo}</span>
                    <span>{abertoBloco ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}</span>
                </button>

                {abertoBloco && (
                    <div className="parte-card-body">
                        <div className="config-row config-row-partes">
                            {campos.map((campo) => {
                                const valorAtual = partes[bloco][campo.key] || "";
                                const mostrarErroCpf =
                                    campo.key === "cpf" &&
                                    valorAtual.replace(/\D/g, "").length === 11 &&
                                    !validarCPF(valorAtual);

                                return (
                                    <div className="form-group" key={`${bloco}-${campo.key}`}>
                                        <label className="form-label">
                                            {campo.label}
                                            {mostrarErroCpf && (
                                                <span className="cpf-invalido-aviso">
                                                    CPF inválido
                                                </span>
                                            )}
                                        </label>

                                        <input
                                            type="text"
                                            className={`form-input ${mostrarErroCpf ? "form-input-erro" : ""}`}
                                            value={valorAtual}
                                            onChange={(e) =>
                                                handleChangeParte(bloco, campo.key, e.target.value)
                                            }
                                            placeholder={`Digite ${campo.label.toLowerCase()}`}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderTestemunha = (titulo, bloco) => {
        const nomeAtual = partes[bloco]?.nome || "";
        const cpfAtual = partes[bloco]?.cpf || "";
        const mostrarErroCpf =
            cpfAtual.replace(/\D/g, "").length === 11 && !validarCPF(cpfAtual);

        return (
            <div className="parte-card">
                <div className="parte-card-body">
                    <h4 className="card-subtitle">{titulo}</h4>

                    <div className="config-row">
                        <div className="form-group">
                            <label className="form-label">Nome</label>
                            <input
                                type="text"
                                className="form-input"
                                value={nomeAtual}
                                onChange={(e) =>
                                    handleChangeParte(bloco, "nome", e.target.value)
                                }
                                placeholder="Digite o nome"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                CPF
                                {mostrarErroCpf && (
                                    <span className="cpf-invalido-aviso">
                                    CPF inválido
                                </span>
                                )}
                            </label>

                            <input
                                type="text"
                                className={`form-input ${mostrarErroCpf ? "form-input-erro" : ""}`}
                                value={cpfAtual}
                                onChange={(e) =>
                                    handleChangeParte(bloco, "cpf", e.target.value)
                                }
                                placeholder="Digite o CPF"
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (!aberto) return null;

    return (
        <div className="acordo-overlay" onClick={onFechar}>
            <div className="acordo-modal" onClick={(e) => e.stopPropagation()}>
                <div className="acordo-header">
                    <div className="acordo-title-group">
                        <FileText size={20}/>
                        <h2>Acordo de Crédito</h2>
                    </div>
                    <button className="acordo-fechar" onClick={onFechar}>
                        <X size={20}/>
                    </button>
                </div>

                <div className="acordo-body">
                    <div className="acordo-layout">

                        <div className="acordo-coluna acordo-coluna-esquerda">
                            <div className="acordo-card partes-wrapper">
                                <h3 className="card-title">Dados das Partes</h3>
                                {renderBlocoParte("Notificado", "notificado", camposNotificado)}
                                {renderBlocoParte("Sócio", "socio", camposPessoaFisica)}
                                {renderBlocoParte("Avalista", "avalista", camposPessoaFisica)}
                                {renderBlocoParte("Devedor Solidário", "devedorSolidario", camposPessoaFisica)}
                            </div>

                            <div className="acordo-card">
                                <div className="selecao-header">
                                    <h3>Selecione as duplicatas</h3>
                                    <button
                                        type="button"
                                        className="btn-selecionar-todas"
                                        onClick={toggleTodas}
                                    >
                                        {selecionadas.length === duplicatasVencidas.length
                                            ? "Desmarcar Todas"
                                            : "Selecionar Todas"}
                                    </button>
                                </div>

                                {duplicatasVencidas.length === 0 ? (
                                    <EmptyState
                                        icon={FileText}
                                        title="Nenhuma duplicata encontrada"
                                        subtitle="Esse cliente não possui duplicatas vencidas para incluir no acordo."
                                    />
                                ) : (
                                    <div className="duplicatas-lista">
                                        {duplicatasVencidas.map((dup) => (
                                            <label
                                                key={dup.id}
                                                className={`duplicata-check ${
                                                    selecionadas.includes(dup.id)
                                                        ? "duplicata-selecionada"
                                                        : ""
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selecionadas.includes(dup.id)}
                                                    onChange={() => toggleSelecao(dup.id)}
                                                />
                                                <div className="duplicata-check-info">
                                                    <code>{dup.duplicata}</code>
                                                    <span className="duplicata-check-parcela">
                                                            {dup.parcela}
                                                        </span>
                                                </div>
                                                <span className="duplicata-check-valor">
                                                        {formatCurrency(dup.valor)}
                                                    </span>
                                                <span
                                                    className={
                                                        dup.diasAtraso > 0
                                                            ? "duplicata-check-atraso"
                                                            : "duplicata-check-a-vencer"
                                                    }
                                                >
                                                        {dup.diasAtraso > 0
                                                            ? `${dup.diasAtraso}d atraso`
                                                            : "A vencer"}
                                                    </span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="acordo-coluna acordo-coluna-direita">
                            <div className="acordo-card acordo-config">
                                <h3 className="card-title">Encargos</h3>

                                <div className="config-row">
                                    <div className="form-group">
                                        <label className="form-label">Pagamento</label>
                                        <select
                                            className="form-select"
                                            value={tipoAcordo}
                                            onChange={(e) => {
                                                setTipoAcordo(e.target.value);
                                                if (e.target.value === "parcelado") setParcelas(2);
                                            }}
                                        >
                                            <option value="avista">Á Vista</option>
                                            <option value="parcelado">Parcelado</option>
                                        </select>
                                    </div>

                                    {tipoAcordo === "parcelado" && (
                                        <div className="form-group">
                                            <label className="form-label">Parcelas</label>
                                            <select
                                                className="form-select"
                                                value={parcelas}
                                                onChange={(e) => setParcelas(Number(e.target.value))}
                                            >
                                                {Array.from({length: 23}, (_, i) => i + 2).map((n) => (
                                                    <option key={n} value={n}>
                                                        {n}x
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <div className="config-row">
                                    <div className="form-group">
                                        <label className="form-label">Data 1º Pagamento</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={dataPagamentoManual}
                                            onChange={(e) => setDataPagamentoManual(e.target.value)}
                                        />
                                    </div>

                                    {(() => {
                                        const jurosMora = encargos.find(e => e.tipo === 'juros_mora');
                                        return jurosMora ? (
                                            <div className="form-group">
                                                <label className="form-label">{LABELS_ENCARGO['juros_mora']}</label>
                                                <div className="input-with-symbol">
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        value={jurosMora.valor}
                                                        onChange={(e) => atualizarEncargo(jurosMora.id, 'valor', parseFloat(e.target.value) || 0)}
                                                        step="0.1"
                                                        min="0"
                                                        placeholder="0"
                                                    />
                                                    <span className="symbol">%</span>
                                                </div>
                                            </div>
                                        ) : null;
                                    })()}
                                </div>

                                <div className="config-row">
                                    {(() => {
                                        const parcelasPagasEncargo = encargos.find(e => e.tipo === 'parcelas_pagas');
                                        return parcelasPagasEncargo ? (
                                            <div className="form-group">
                                                <label className="form-label">{LABELS_ENCARGO['parcelas_pagas']}</label>
                                                <div className="input-with-symbol">
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        value={parcelasPagasEncargo.valor}
                                                        onChange={(e) => atualizarEncargo(parcelasPagasEncargo.id, 'valor', parseInt(e.target.value) || 0)}
                                                        step="1"
                                                        min="0"
                                                        placeholder="0"
                                                    />
                                                    <span className="symbol">Qtd</span>
                                                </div>
                                            </div>
                                        ) : null;
                                    })()}
                                </div>

                                <div className="encargos-dinamicos">
                                    <h4 className="encargos-subtitle">Encargos Adicionais</h4>

                                    {(() => {
                                        const encargosAdicionados = encargos.filter(e => !CAMPOS_FIXOS.includes(e.tipo));
                                        return encargosAdicionados.length > 0 ? (
                                            <div className="encargos-lista">
                                                {encargosAdicionados.map((encargo) => (
                                                    <CampoEncargo
                                                        key={encargo.id}
                                                        encargo={encargo}
                                                        onAtualizar={atualizarEncargo}
                                                        onRemover={removerEncargo}
                                                    />
                                                ))}
                                            </div>
                                        ) : null;
                                    })()}

                                    <MenuAdicionarEncargo
                                        encargosAdicionados={encargosAdicionados}
                                        onAdicionar={adicionarEncargo}
                                        aberto={menuEncargosAberto}
                                        onToggle={() => setMenuEncargosAberto(!menuEncargosAberto)}
                                    />
                                </div>

                            </div>

                            {simulacao && (
                                <div className="acordo-card">
                                    <h3 className="card-title">Resumo do Acordo</h3>

                                    <div className="resultado-linhas">
                                        <div className="resultado-linha">
                                            <span>Subtotal (d&iacute;vidas selecionadas)</span>
                                            <span>{formatCurrency(simulacao.subtotalBruto)}</span>
                                        </div>

                                        {simulacao.entrada > 0 && (
                                            <div className="resultado-linha">
                                                <span>Entrada</span>
                                                <span>- {formatCurrency(simulacao.entrada)}</span>
                                            </div>
                                        )}

                                        <div className="resultado-linha">
                                            <span>Saldo a Financiar</span>
                                            <span>{formatCurrency(simulacao.subtotal)}</span>
                                        </div>

                                        {simulacao.juros > 0 && (
                                            <div className="resultado-linha">
                                                <span>Juros</span>
                                                <span>+ {formatCurrency(simulacao.juros)}</span>
                                            </div>
                                        )}

                                        {simulacao.multa > 0 && (
                                            <div className="resultado-linha">
                                                <span>Multa</span>
                                                <span>+ {formatCurrency(simulacao.multa)}</span>
                                            </div>
                                        )}

                                        {simulacao.honorarios > 0 && (
                                            <div className="resultado-linha">
                                                <span>Honorários</span>
                                                <span>+ {formatCurrency(simulacao.honorarios)}</span>
                                            </div>
                                        )}

                                        <div className="resultado-linha resultado-total">
                                            <span>Total Final</span>
                                            <span>{formatCurrency(simulacao.totalFinal)}</span>
                                        </div>

                                        {simulacao.numParcelas > 1 && (
                                            <div className="resultado-linha resultado-parcela">
                                                <span>{simulacao.numParcelas}x de</span>
                                                <span>{formatCurrency(simulacao.valorParcela)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="acordo-card">
                                <h3 className="card-title">Testemunhas</h3>

                                {renderTestemunha("Testemunha 1", "testemunha1")}
                                {renderTestemunha("Testemunha 2", "testemunha2")}
                            </div>

                            <div className="acordo-card acordo-documentos">
                                <h3 className="card-title">Gerar Documentos</h3>
                                <p className="documentos-descricao">Selecione um documento para visualizar a prévia
                                    antes de baixar.</p>

                                <div className="documentos-lista">
                                    {modelos.map((modelo) => (
                                        <button
                                            key={modelo.nome}
                                            type="button"
                                            className={"documento-card"}
                                            onClick={() => handleSelecionarDocumento(modelo.nome)}
                                        >
                                            <div className="documento-icon">
                                                <FileText size={24}/>
                                            </div>
                                            <div className="documento-info">
                                                <h4 className="documento-nome">{modelo.nome}</h4>
                                                <p className="documento-tipo">{modelo.tipo}</p>
                                            </div>
                                            <ChevronRight size={20} className="documento-arrow"/>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>


                </div>

                {simulacao && tipoArquivo && (
                    <PreviewAcordo
                        aberto={previewAberto}
                        onFechar={() => setPreviewAberto(false)}
                        docBuffer={obterModelo(tipoArquivo)}
                        dadosBase={dadosBaseDocumento}
                        onGerarArquivo={handleGerarArquivo}
                        gerando={gerando}
                    />
                )}
            </div>
        </div>
    );
}

export default AcordoCredito;