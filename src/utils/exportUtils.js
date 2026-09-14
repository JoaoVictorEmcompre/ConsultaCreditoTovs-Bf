import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const COLUMNS = [
    {key: 'duplicata', label: 'Duplicata'},
    {key: 'parcela', label: 'Parcela'},
    {key: 'valor', label: 'Valor'},
    {key: 'valorPag', label: 'Valor Pago'},
    {key: 'dataEmissao', label: 'Data Emissão'},
    {key: 'dataVencimento', label: 'Data Vencimento'},
    {key: 'dataPagamento', label: 'Data Pagamento'},
    {key: 'diasAtraso', label: 'Dias Atraso'},
    {key: 'statusPagamento', label: 'Status'},
    {key: 'conta', label: 'Conta'}
];

const FILIAL_COLUMN = {key: 'filial', label: 'Filial'};

const getColumns = (incluirFilial) => incluirFilial ? [FILIAL_COLUMN, ...COLUMNS] : COLUMNS;

export const exportToCSV = (data, filename = 'duplicatas.csv', incluirFilial = false) => {
    if (!data.length) {
        alert('Nenhum dado para exportar');
        return;
    }

    const columns = getColumns(incluirFilial);
    const header = columns.map(col => `"${col.label}"`).join(',');

    const rows = data.map(item =>
        columns.map(col => {
            let value = item[col.key] || '';
            value = String(value).replace(/"/g, '""');
            return `"${value}"`;
        }).join(',')
    );

    // Combine Header and rows
    const csv = [header, ...rows].join('\n');

    // Create blob and download
    downloadFile(csv, filename, 'text/csv;charset=utf-8;');
};

export const exportToXLSX = (data, filename = 'duplicatas.xlsx', incluirFilial = false) => {
    if (!data.length) {
        alert('Nenhum dado para exportar');
        return;
    }

    const columns = getColumns(incluirFilial);
    const worksheetData = [
        columns.map(col => col.label),
        ...data.map(item =>
            columns.map(col => item[col.key] || '')
        )
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Duplicatas');

    ws['!cols'] = columns.map(col => {
        const lengths = [col.label.length];
        return {wch: Math.max(...lengths) + 2};
    });

    XLSX.writeFile(wb, filename);
};

export const exportToXLS = (data, filename = 'duplicatas.xls', incluirFilial = false) => {
    if (!data.length) {
        alert('Nenhum dado para exportar');
        return;
    }

    const columns = getColumns(incluirFilial);
    const worksheetData = [
        columns.map(col => col.label),
        ...data.map(item =>
            columns.map(col => item[col.key] || '')
        )
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Duplicatas');

    XLSX.writeFile(wb, filename, {bookType: 'xls'});
};

export const exportToPDF = async (data, filename = 'duplicatas.pdf', incluirFilial = false) => {
    if (!data.length) {
        alert('Nenhum dado para exportar');
        return;
    }

    const columns = getColumns(incluirFilial);

    try {
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.backgroundColor = '#fff';

        const headerRow = table.insertRow();
        headerRow.style.backgroundColor = '#f8fafc';
        columns.forEach(col => {
            const cell = headerRow.insertCell();
            cell.textContent = col.label;
            cell.style.border = '1px solid #e2e8f0';
            cell.style.padding = '8px';
            cell.style.fontWeight = 'bold';
            cell.style.fontSize = '12px';
        });

        data.forEach((item, index) => {
            const row = table.insertRow();
            row.style.backgroundColor = index % 2 === 0 ? '#fff' : '#f8fafc';
            columns.forEach(col => {
                const cell = row.insertCell();
                cell.textContent = item[col.key] || '';
                cell.style.border = '1px solid #e2e8f0';
                cell.style.padding = '8px';
                cell.style.fontSize = '11px';
            });
        });

        table.style.position = 'absolute';
        table.style.left = '-9999px';
        document.body.appendChild(table);

        const canvas = await html2canvas(table, {
            backgroundColor: '#fff',
            scale: 2
        });

        document.body.removeChild(table);

        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        while (heightLeft >= 0) {
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
            if (heightLeft > 0) {
                pdf.addPage();
                position = heightLeft - imgHeight;
            }
        }

        pdf.save(filename);
    } catch (error) {
        console.error('Erro ao exportar para PDF:', error);
        alert('Erro ao gerar PDF. Tente novamente.');
    }
};

const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], {type: mimeType});
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};
