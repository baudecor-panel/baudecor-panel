// Ürün alış faturaları ürünün maliyet fiyatıyla zaten satışta düşülüyor.
// Bu yüzden net kâr hesabına girmez, sadece kasadan düşülür.
export const PURCHASE_EXPENSE_TYPE = "Roba / Mal Alımı";

export const EXPENSE_TYPES = [
  "Zakup / Kira",
  "Plata / Maaş",
  "Struja / Elektrik",
  "Internet / İnternet",
  "Prevoz / Nakliye",
  "Carina / Gümrük",
  "Oglašavanje / Reklam",
  "Popravka / Tamirat",
  "Porez / Vergi",
  PURCHASE_EXPENSE_TYPE,
  "Ostalo / Diğer",
];

export function isOperatingExpense(type?: string | null) {
  return type !== PURCHASE_EXPENSE_TYPE;
}
