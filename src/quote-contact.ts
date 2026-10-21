export type QuoteContact = { email: string; instagram: string };

export const quoteContactError = 'Informe um e-mail completo, como nome@exemplo.com, ou seu Instagram começando com @.';

export function parseQuoteContact(value: string): QuoteContact | null {
  const contact = value.trim();
  if (!contact) return { email: '', instagram: '' };
  if (/^@[a-zA-Z0-9._]+$/.test(contact) && contact.length <= 100) {
    return { email: '', instagram: contact };
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) && contact.length <= 150) {
    return { email: contact, instagram: '' };
  }
  return null;
}
