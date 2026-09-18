export const BRANCH_CODES = [
    { value: 1, label: 'Filial 1' },
    { value: 2, label: 'Filial 2' },
    { value: 3, label: 'Filial 3' },
    { value: 4, label: 'Filial 4' },
    { value: 5, label: 'Filial 5' },
    { value: 6, label: 'Filial 6' },
    { value: 7, label: 'Filial 7' },
    { value: 8, label: 'Filial 8' },
];

export const DEFAULT_EXTERNAL_BRANCH_CODE = 1;

export function getBranchLabel(code) {
    const found = BRANCH_CODES.find((branch) => !Array.isArray(branch.value) && branch.value === code);
    return found ? found.label : `Filial ${code}`;
}
