/**
 * Spoljni izvori podataka. U MVP-u SVI imaju samo DUMMY implementaciju
 * (src/integrations/dummy) i TREBA DA SE ODRADI PRAVA INTEGRACIJA.
 * Spisak i šta svaki treba da radi: MVP-IMPLEMENTACIJA.md, odeljak „Dummy integracije”.
 */
export enum IntegrationKey {
  /** Srbija: APR, status firme, osnivači, zastupnici (veb-servis po ugovoru). */
  RsAprCompany = 'RS_APR_COMPANY',
  /** Srbija: NBS, blokada računa (veb-servis, ≈4 RSD po upitu). */
  RsNbsBlockade = 'RS_NBS_BLOCKADE',
  /** Srbija: Poreska uprava, godišnji spisak najvećih poreskih dužnika. */
  RsTaxDebtors = 'RS_TAX_DEBTORS',
  /** Kipar: Registrar of Companies (mesečni CSV, CC BY 4.0). */
  CyRegistrarCompany = 'CY_REGISTRAR_COMPANY',
  /** Kipar: Department of Insolvency, registar likvidacija. */
  CyInsolvency = 'CY_INSOLVENCY',
  /** Kipar: DLS WFS, podaci o parceli (broj, površina, zona) bez vlasnika i tereta. */
  CyDlsParcel = 'CY_DLS_PARCEL',
}
