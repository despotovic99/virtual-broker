// Access token se čuva samo u memoriji. Nikad u localStorage ni sessionStorage,
// da ga XSS ne može pročitati posle osvežavanja stranice. Posle osvežavanja
// nov access token stiže preko refresh cookie-ja.
let accessToken: string | null = null

export const tokenStore = {
  get: (): string | null => accessToken,
  set: (token: string): void => {
    accessToken = token
  },
  clear: (): void => {
    accessToken = null
  },
}
