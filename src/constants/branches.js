export const BRANCH_CODES = [
    {value: 1, label: 'Filial 1'},
    {value: 6, label: 'Filial 6'},
    {value: [1, 6], label: 'Ambas'},
];

export const DEFAULT_EXTERNAL_BRANCH_CODE = 1;

export function getBranchLabel(code) {
    const found = BRANCH_CODES.find((branch) => !Array.isArray(branch.value) && branch.value === code);
    return found ? found.label : `Filial ${code}`;
}
