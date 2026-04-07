/**
 * FiscalPrinterService handles communication with Epson FP series printers
 * using the ePOS-Print XML protocol.
 */
class FiscalPrinterService {
    constructor() {
        this.printerIp = localStorage.getItem('printerIp') || '';
        this.timeout = 5000;
    }

    async printReceipt(orderData, type = 'fiscal') {
        if (!this.printerIp) {
            console.warn('No printer IP configured. Skipping print.');
            return { success: false, message: 'Printer not configured' };
        }

        try {
            const xml = this.buildXml(orderData, type);
            const response = await fetch(`http://${this.printerIp}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=${this.timeout}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'If-Modified-Since': 'Thu, 01 Jan 1970 00:00:00 GMT',
                    'SOAPAction': '""'
                },
                body: xml
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const text = await response.text();
            return { success: true, data: text };
        } catch (error) {
            console.error('Fiscal Print Error:', error);
            return { success: false, error: error.message };
        }
    }

    buildXml(orderData, type) {
        // Basic Epson ePOS-Print XML wrapper
        // In a real scenario, this would generate complex ESC/POS or Fiscal XML tags
        // For this professional demo, we provide a robust structure.
        
        let protocol = '<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>';
        protocol += '<printer xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">';
        
        // Header
        protocol += '<text>SvaPro POS System\n</text>';
        protocol += `<text>Azienda: ${orderData.tenant_name || 'SvaPro'}\n</text>`;
        protocol += `<text>Data: ${new Date().toLocaleString()}\n</text>`;
        protocol += '<text>--------------------------------\n</text>';

        // Items
        orderData.lines.forEach(line => {
            const name = line.product_name.substring(0, 20).padEnd(20);
            const qty = line.qty.toString().padStart(3);
            const price = (line.sale_price * line.qty).toFixed(2).padStart(8);
            protocol += `<text>${name} ${qty} ${price}\n</text>`;
        });

        protocol += '<text>--------------------------------\n</text>';
        protocol += `<text>TOTALE:   EUR ${orderData.totals.grand_total.toFixed(2).padStart(15)}\n</text>`;
        
        if (type === 'fiscal') {
            protocol += '<text>DOCUMENTO COMMERCIALE\n</text>';
        } else {
            protocol += '<text>NON FISCALE / CORTESIA\n</text>';
        }

        protocol += '<cut type="feed"/>';
        protocol += '</printer></s:Body></s:Envelope>';
        
        return protocol;
    }
}

export default new FiscalPrinterService();
