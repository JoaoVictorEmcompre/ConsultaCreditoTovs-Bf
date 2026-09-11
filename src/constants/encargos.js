export const TIPOS_ENCARGO = {
    JUROS_MENSAL: 'juros_mensal',
    JUROS_PARCELAMENTO: 'juros_parcelamento',
    JUROS_MORA: 'juros_mora',
    MULTA: 'multa',
    HONORARIOS: 'honorarios',
    ENTRADA: 'entrada',
    PARCELAS_PAGAS: 'parcelas_pagas'
};

export const VALORES_PADRAO = {
    juros_mensal: {valor: 5, compostoSimples: 'simples'},
    juros_parcelamento: {valor: 2.5, compostoSimples: 'composto'},
    juros_mora: {valor: 1, compostoSimples: 'simples'},
    multa: {valor: 20, compostoSimples: null},
    honorarios: {valor: 10, compostoSimples: null},
    entrada: {valor: 0, compostoSimples: null},
    parcelas_pagas: {valor: 0, compostoSimples: null}
};

export const LABELS_ENCARGO = {
    juros_mensal: 'Taxa de Juros',
    juros_parcelamento: 'Juros de Parcelamento',
    juros_mora: 'Juros de Mora',
    multa: 'Multa',
    honorarios: 'Honorários',
    entrada: 'Valor Entrada',
    parcelas_pagas: 'Parcelas Pagas'
};

export const ORDEM_ENCARGOS = [
    'juros_mensal',
    'juros_parcelamento',
    'multa',
    'honorarios',
    'entrada'
];

export const CAMPOS_FIXOS = [
    'juros_mora',
    'parcelas_pagas'
];

export const ehJuros = (tipo) => {
    return ['juros_mensal', 'juros_parcelamento', 'juros_mora'].includes(tipo);
};

export const ehValorMonetario = (tipo) => {
    return tipo === 'entrada';
};

export const ehQuantidade = (tipo) => {
    return tipo === 'parcelas_pagas';
};

export const ehCampoFixo = (tipo) => {
    return CAMPOS_FIXOS.includes(tipo);
};
