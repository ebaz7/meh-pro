
import { apiCall } from '../services/apiService';

type PdfFormat = 'A4' | 'A5' | 'A3';
type PdfOrientation = 'portrait' | 'landscape';

export interface PdfOptions {
    elementId: string;
    filename: string;
    format?: PdfFormat;
    orientation?: PdfOrientation;
    width?: string;
    height?: string;
    onComplete?: () => void;
    onError?: (error: any) => void;
}

export const generatePdf = async ({
    elementId,
    filename,
    format,
    orientation = 'portrait',
    width,
    height,
    onComplete,
    onError
}: PdfOptions) => {
    const originalElement = document.getElementById(elementId);
    
    if (!originalElement) {
        if (onError) onError(new Error('Element not found'));
        return;
    }

    try {
        // 1. Get HTML Content
        const clone = originalElement.cloneNode(true) as HTMLElement;
        
        // Remove no-print elements
        const noPrints = clone.querySelectorAll('.no-print');
        noPrints.forEach(el => el.remove());

        // Sync inputs
        const inputs = clone.querySelectorAll('input, select, textarea');
        inputs.forEach((input: any) => {
            if (input.type === 'checkbox' || input.type === 'radio') {
                if (input.checked) input.setAttribute('checked', 'checked');
            } else if (input.tagName === 'SELECT') {
                const selectedOption = input.options[input.selectedIndex];
                if (selectedOption) selectedOption.setAttribute('selected', 'selected');
            } else {
                input.setAttribute('value', input.value);
                input.textContent = input.value; 
            }
        });

        const htmlContent = clone.outerHTML;

        // 2. Extract Styles (Robust approach)
        let collectedStyles = '';
        
        // A. From <style> tags (Vite dev)
        const styleTags = document.querySelectorAll('style');
        styleTags.forEach(tag => {
            collectedStyles += tag.innerHTML + "\n";
        });

        // B. From <link rel="stylesheet"> (Production)
        // Accessing cssRules can throw CORS errors for external domains, so we wrap in try-catch
        Array.from(document.styleSheets).forEach(sheet => {
            try {
                // If it's a local sheet or CORS-allowed, this works.
                // If blocked, it throws and we catch it (skipping that sheet).
                // Usually app styles are local/same-origin.
                const rules = sheet.cssRules;
                if (rules) {
                    Array.from(rules).forEach(rule => {
                        collectedStyles += rule.cssText + "\n";
                    });
                }
            } catch (e) {
                // Ignore cross-origin stylesheets (like Google Fonts) to prevent crash
                // They won't render in PDF unless server has access, which is fine for basic structure
            }
        });

        // 3. Prepare Full HTML
        const fullHtml = `
            <!DOCTYPE html>
            <html lang="fa" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <style>
                    /* ZERO MARGIN RESET FOR PDF ENGINE */
                    @page { margin: 0; size: auto; }
                    
                    body { 
                        font-family: 'Vazirmatn', sans-serif; 
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact; 
                        margin: 0;
                        padding: 0;
                        width: 100%;
                        height: 100%;
                    }
                    input, select, textarea { background: transparent; border: none; font-family: inherit; }
                    .printable-content { margin: 0 auto; width: 100%; height: 100%; box-shadow: none !important; }
                    
                    /* INJECTED APP STYLES */
                    ${collectedStyles}
                </style>
            </head>
            <body>
                ${htmlContent}
            </body>
            </html>
        `;

        // 4. Send to Backend
        const body: any = {
            html: fullHtml,
            landscape: orientation === 'landscape',
            width,
            height
        };
        
        if (format) body.format = format;

        const response = await fetch('/api/render-pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            // Provide a more helpful error message if payload was too large
            if (response.status === 413) {
                 throw new Error("حجم اطلاعات برای تبدیل به PDF بسیار زیاد است (Payload Too Large).");
            }
            throw new Error((errData.error || 'Server Error') + (errData.details ? `: ${errData.details}` : ''));
        }

        // 5. Download Blob
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        if (onComplete) onComplete();

    } catch (error: any) {
        console.error('PDF Generator Error:', error);
        alert(`خطا در ایجاد PDF: ${error.message}`);
        if (onError) onError(error);
    }
};
