/**
 * Bancos venezolanos con sus códigos oficiales (SUDEBAN).
 * El código (4 dígitos) es el formato que espera el banco en operaciones
 * como pago móvil (P2C) y crédito inmediato (VOB /cce/credit).
 */

export interface Bank {
  code: string;
  name: string;
}

export const BANCOS_VENEZUELA: Bank[] = [
  { code: '0102', name: 'Banco de Venezuela' },
  { code: '0104', name: 'Banco Venezolano de Crédito' },
  { code: '0105', name: 'Banco Mercantil' },
  { code: '0114', name: 'Bancaribe' },
  { code: '0115', name: 'Banco Exterior' },
  { code: '0116', name: 'Banco Occidental de Descuento (BOD)' },
  { code: '0128', name: 'Banco Caroní' },
  { code: '0134', name: 'Banesco' },
  { code: '0137', name: 'Banco Sofitasa' },
  { code: '0138', name: 'Banco Plaza' },
  { code: '0146', name: 'Banco de la Gente Emprendedora (Bangente)' },
  { code: '0151', name: 'BFC Banco Fondo Común' },
  { code: '0156', name: '100% Banco' },
  { code: '0157', name: 'Banco del Sur' },
  { code: '0163', name: 'Banco del Tesoro' },
  { code: '0166', name: 'Banco Agrícola de Venezuela' },
  { code: '0168', name: 'Bancrecer' },
  { code: '0169', name: 'Mi Banco' },
  { code: '0171', name: 'Banco Activo' },
  { code: '0172', name: 'Bancamiga' },
  { code: '0173', name: 'Banco Internacional de Desarrollo' },
  { code: '0174', name: 'Banplus' },
  { code: '0175', name: 'Banco Bicentenario' },
  { code: '0176', name: 'Banco de la Fuerza Armada (BANFANB)' },
  { code: '0177', name: 'Banco de la Mujer' },
  { code: '0190', name: 'Citibank' },
  { code: '0191', name: 'Banco Nacional de Crédito (BNC)' },
];

export function getBankName(code?: string): string {
  if (!code) return '';
  return BANCOS_VENEZUELA.find(b => b.code === code)?.name || code;
}
