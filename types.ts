
export enum UserRole {
  ADMIN = 'admin',
  CEO = 'ceo',
  FINANCIAL = 'financial',
  MANAGER = 'manager',
  SALES_MANAGER = 'sales_manager',
  FACTORY_MANAGER = 'factory_manager',
  WAREHOUSE_KEEPER = 'warehouse_keeper',
  SECURITY_HEAD = 'security_head',
  SECURITY_GUARD = 'security_guard',
  USER = 'user'
}

export enum PaymentMethod {
  TRANSFER = 'حواله بانکی',
  CHEQUE = 'چک',
  SHEBA = 'شبا',
  INTERNAL_TRANSFER = 'انتقال داخلی',
  SATNA = 'ساتنا',
  PAYA = 'پایا',
  CASH = 'نقد',
  POS = 'کارتخوان'
}

export enum OrderStatus {
  PENDING = 'در انتظار بررسی مالی',
  APPROVED_FINANCE = 'تایید مالی / در انتظار مدیریت',
  APPROVED_MANAGER = 'تایید مدیریت / در انتظار مدیرعامل',
  APPROVED_CEO = 'تایید نهایی',
  REJECTED = 'رد شده',
  REVOCATION_PENDING_FINANCE = 'درخواست ابطال (مالی)',
  REVOCATION_PENDING_MANAGER = 'تایید ابطال (مدیریت)',
  REVOCATION_PENDING_CEO = 'تایید ابطال (مدیرعامل)',
  REVOKED = 'باطل شده'
}

export enum ExitPermitStatus {
  PENDING_CEO = 'در انتظار تایید مدیرعامل',
  PENDING_FACTORY = 'تایید مدیرعامل / در انتظار خروج (کارخانه)',
  PENDING_WAREHOUSE = 'در انتظار تایید انبار',
  PENDING_SECURITY = 'در انتظار تایید انتظامات',
  EXITED = 'خارج شده (بایگانی)',
  REJECTED = 'رد شده'
}

export enum SecurityStatus {
  PENDING_SUPERVISOR = 'در انتظار تایید سرپرست',
  APPROVED_SUPERVISOR_CHECK = 'تایید سرپرست / در انتظار مدیر',
  PENDING_FACTORY = 'در انتظار تایید مدیر کارخانه',
  APPROVED_FACTORY_CHECK = 'تایید مدیر کارخانه / در انتظار مدیرعامل',
  PENDING_CEO = 'در انتظار تایید مدیرعامل',
  ARCHIVED = 'بایگانی شده',
  REJECTED = 'رد شده'
}

export enum TradeStage {
  LICENSES = 'مجوزها و پروفرما',
  INSURANCE = 'بیمه',
  ALLOCATION_QUEUE = 'در صف تخصیص ارز',
  ALLOCATION_APPROVED = 'تخصیص یافته',
  CURRENCY_PURCHASE = 'خرید ارز',
  SHIPPING_DOCS = 'اسناد حمل',
  INSPECTION = 'گواهی بازرسی',
  CLEARANCE_DOCS = 'ترخیصیه و قبض انبار',
  GREEN_LEAF = 'برگ سبز',
  INTERNAL_SHIPPING = 'حمل داخلی',
  AGENT_FEES = 'هزینه‌های ترخیص'
}

export interface User {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  role: UserRole | string;
  avatar?: string;
  phoneNumber?: string;
  telegramChatId?: string;
  canManageTrade?: boolean;
  receiveNotifications?: boolean;
}

export interface PaymentDetail {
  id: string;
  method: PaymentMethod;
  amount: number;
  bankName?: string;
  chequeNumber?: string;
  chequeDate?: string;
  sheba?: string;
  recipientBank?: string;
  paymentId?: string;
  destinationAccount?: string;
  destinationOwner?: string;
  destinationBranch?: string;
  description?: string;
}

export interface PaymentOrder {
  id: string;
  trackingNumber: number;
  date: string;
  payee: string;
  totalAmount: number;
  description: string;
  status: OrderStatus;
  requester: string;
  payingCompany: string;
  paymentDetails: PaymentDetail[];
  attachments?: { fileName: string, data: string }[];
  approverFinancial?: string;
  approverManager?: string;
  approverCeo?: string;
  rejectionReason?: string;
  rejectedBy?: string;
  createdAt: number;
  updatedAt?: number;
  fiscalYearId?: string;
}

export interface ExitPermitItem {
  id: string;
  goodsName: string;
  cartonCount: number | string;
  weight: number | string;
  deliveredCartonCount?: number;
  deliveredWeight?: number;
}

export interface ExitPermitDestination {
  id: string;
  recipientName: string;
  address: string;
  phone?: string;
}

export interface ExitPermit {
  id: string;
  permitNumber: number;
  date: string;
  requester: string;
  items: ExitPermitItem[];
  destinations: ExitPermitDestination[];
  goodsName?: string;
  recipientName?: string;
  destinationAddress?: string;
  cartonCount?: number;
  weight?: number;
  plateNumber?: string;
  driverName?: string;
  description?: string;
  status: ExitPermitStatus;
  approverCeo?: string;
  approverFactory?: string;
  approverWarehouse?: string;
  approverSecurity?: string;
  exitTime?: string;
  rejectionReason?: string;
  rejectedBy?: string;
  createdAt: number;
  updatedAt?: number;
  sentToGroup?: boolean;
  fiscalYearId?: string;
}

export interface WarehouseItem {
  id: string;
  name: string;
  code: string;
  unit: string;
  containerCapacity?: number;
}

export interface WarehouseTransactionItem {
  itemId: string;
  itemName: string;
  quantity: number;
  weight: number;
  unitPrice?: number;
}

export interface WarehouseTransaction {
  id: string;
  type: 'IN' | 'OUT';
  date: string;
  company: string;
  number?: number;
  proformaNumber?: string;
  recipientName?: string;
  driverName?: string;
  plateNumber?: string;
  destination?: string;
  items: WarehouseTransactionItem[];
  description?: string;
  createdAt: number;
  createdBy: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  rejectionReason?: string;
  rejectedBy?: string;
  updatedAt?: number;
  fiscalYearId?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export interface RolePermissions {
  canViewAll?: boolean;
  canCreatePaymentOrder?: boolean;
  canViewPaymentOrders?: boolean;
  canApproveFinancial?: boolean;
  canApproveManager?: boolean;
  canApproveCeo?: boolean;
  canEditOwn?: boolean;
  canEditAll?: boolean;
  canDeleteOwn?: boolean;
  canDeleteAll?: boolean;
  
  canManageTrade?: boolean;
  canManageSettings?: boolean;
  
  canCreateExitPermit?: boolean;
  canViewExitPermits?: boolean;
  canApproveExitCeo?: boolean;
  canApproveExitFactory?: boolean;
  canApproveExitWarehouse?: boolean;
  canApproveExitSecurity?: boolean;
  canViewExitArchive?: boolean;
  canEditExitArchive?: boolean;

  canManageWarehouse?: boolean;
  canViewWarehouseReports?: boolean;
  canApproveBijak?: boolean;

  canViewSecurity?: boolean;
  canCreateSecurityLog?: boolean;
  canApproveSecuritySupervisor?: boolean;
}

export interface CustomRole {
  id: string;
  label: string;
}

export interface Contact {
  id: string;
  name: string;
  number: string;
  isGroup?: boolean;
}

export interface CompanyBank {
  id: string;
  bankName: string;
  accountNumber?: string;
  sheba?: string;
  formLayoutId?: string;
  enableDualPrint?: boolean;
  internalTransferTemplateId?: string;
  internalWithdrawalTemplateId?: string;
  internalDepositTemplateId?: string;
}

export interface Company {
  id: string;
  name: string;
  logo?: string;
  letterhead?: string;
  banks?: CompanyBank[];
  showInWarehouse?: boolean;
  nationalId?: string;
  registrationNumber?: string;
  address?: string;
  postalCode?: string;
  phone?: string;
  fax?: string;
  economicCode?: string;
}

export interface DailyGuardInfo {
  name: string;
  entry: string;
  exit: string;
}

export interface DailySecurityMeta {
  dailyDescription?: string;
  morningGuard?: DailyGuardInfo;
  eveningGuard?: DailyGuardInfo;
  nightGuard?: DailyGuardInfo;
  isFactoryDailyApproved?: boolean;
  isCeoDailyApproved?: boolean;
  isDelaySupervisorApproved?: boolean;
  isDelayFactoryApproved?: boolean;
  isDelayCeoApproved?: boolean;
}

export interface PrintField {
  id: string;
  key: string;
  label: string;
  x: number;
  y: number;
  width?: number;
  fontSize: number;
  align?: 'left' | 'center' | 'right';
  isBold?: boolean;
  letterSpacing?: number;
}

export interface PrintTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  pageSize: 'A4' | 'A5';
  orientation: 'portrait' | 'landscape';
  backgroundImage?: string;
  fields: PrintField[];
}

export interface CompanySequenceConfig {
  startTrackingNumber?: number;
  startExitPermitNumber?: number;
  startBijakNumber?: number;
}

export interface FiscalYear {
  id: string;
  label: string;
  isClosed: boolean;
  companySequences: Record<string, CompanySequenceConfig>;
  createdAt: number;
}

export interface SystemSettings {
  currentTrackingNumber: number;
  currentExitPermitNumber: number;
  companyNames: string[];
  companies?: Company[];
  defaultCompany: string;
  bankNames: string[];
  operatingBankNames?: string[];
  commodityGroups: string[];
  rolePermissions: Record<string, RolePermissions>;
  customRoles?: CustomRole[];
  savedContacts?: Contact[];
  pwaIcon?: string;
  telegramBotToken?: string;
  telegramAdminId?: string;
  smsApiKey?: string;
  smsSenderNumber?: string;
  googleCalendarId?: string;
  whatsappNumber?: string;
  geminiApiKey?: string;
  insuranceCompanies?: string[];
  warehouseSequences?: Record<string, number>;
  exitPermitNotificationGroup?: string;
  exitPermitNotificationGroup2?: string;
  companyNotifications?: Record<string, { salesManager?: string; warehouseGroup?: string; }>;
  defaultWarehouseGroup?: string;
  defaultSalesManager?: string;
  dailySecurityMeta?: Record<string, DailySecurityMeta>;
  printTemplates?: PrintTemplate[];
  activeFiscalYearId?: string;
  fiscalYears?: FiscalYear[];
}

export interface ChatMessage {
  id: string;
  sender: string;
  senderUsername: string;
  role: string;
  message: string;
  timestamp: number;
  recipient?: string;
  groupId?: string;
  attachment?: { fileName: string; url: string };
  audioUrl?: string;
  replyTo?: { id: string; sender: string; message: string };
  isEdited?: boolean;
}

export interface ChatGroup {
  id: string;
  name: string;
  icon?: string;
  members: string[];
  createdBy: string;
}

export interface GroupTask {
  id: string;
  groupId: string;
  title: string;
  assignee?: string;
  isCompleted: boolean;
  createdBy: string;
  createdAt: number;
}

export interface TradeTransaction {
  id: string;
  date: string;
  amount: number;
  bank: string;
  description: string;
}

export interface InsuranceEndorsement {
  id: string;
  date: string;
  amount: number;
  description: string;
}

export interface CurrencyTranche {
  id: string;
  date: string;
  amount: number;
  currencyType: string;
  brokerName: string;
  exchangeName: string;
  rate?: number;
  rialAmount?: number;
  currencyFee?: number;
  isDelivered?: boolean;
  deliveryDate?: string;
  returnAmount?: number;
  returnDate?: string;
  receivedAmount?: number;
}

export interface CurrencyPurchaseData {
  payments: TradeTransaction[];
  purchasedAmount: number;
  purchasedCurrencyType: string;
  purchaseDate?: string;
  brokerName?: string;
  exchangeName?: string;
  deliveredAmount?: number;
  deliveredCurrencyType?: string;
  deliveryDate?: string;
  recipientName?: string;
  remittedAmount?: number;
  isDelivered?: boolean;
  tranches?: CurrencyTranche[];
  guaranteeCheque?: {
    amount: number;
    bank: string;
    chequeNumber: string;
    dueDate: string;
    isDelivered?: boolean;
  };
}

export interface TradeStageData {
  stage: TradeStage;
  isCompleted: boolean;
  description: string;
  costRial: number;
  costCurrency: number;
  currencyType: string;
  attachments: { fileName: string; url: string }[];
  updatedAt: number;
  updatedBy: string;
  queueDate?: string;
  allocationDate?: string;
  allocationCode?: string;
  allocationExpiry?: string;
}

export interface TradeItem {
  id: string;
  name: string;
  hsCode?: string;
  weight: number;
  unitPrice: number;
  totalPrice: number;
}

export type ShippingDocType = 'Commercial Invoice' | 'Packing List' | 'Bill of Lading' | 'Certificate of Origin';
export type DocStatus = 'Draft' | 'Final';

export interface InvoiceItem {
  id: string;
  name: string;
  weight: number;
  unitPrice: number;
  totalPrice: number;
  part: string;
}

export interface PackingItem {
  id: string;
  description: string;
  netWeight: number;
  grossWeight: number;
  packageCount: number;
  part: string;
}

export interface ShippingDocument {
  id: string;
  type: ShippingDocType;
  status: DocStatus;
  documentNumber: string;
  documentDate: string;
  createdAt: number;
  createdBy: string;
  attachments: { fileName: string; url: string }[];
  invoiceItems?: InvoiceItem[];
  packingItems?: PackingItem[];
  freightCost?: number;
  currency?: string;
  netWeight?: number;
  grossWeight?: number;
  packagesCount?: number;
  vesselName?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  description?: string;
}

export interface InspectionCertificate {
  id: string;
  part: string;
  company: string;
  certificateNumber: string;
  amount: number;
  description: string;
}

export interface InspectionPayment {
  id: string;
  part: string;
  amount: number;
  date: string;
  bank: string;
  description: string;
}

export interface InspectionData {
  certificates: InspectionCertificate[];
  payments: InspectionPayment[];
  certificateNumber?: string;
  inspectionCompany?: string;
  totalInvoiceAmount?: number;
}

export interface WarehouseReceipt {
  id: string;
  number: string;
  part: string;
  issueDate: string;
}

export interface ClearancePayment {
  id: string;
  amount: number;
  part: string;
  bank: string;
  date: string;
  payingBank?: string;
}

export interface ClearanceData {
  receipts: WarehouseReceipt[];
  payments: ClearancePayment[];
}

export interface GreenLeafCustomsDuty {
  id: string;
  cottageNumber: string;
  part: string;
  amount: number;
  paymentMethod: 'Bank' | 'Guarantee';
  bank?: string;
  date?: string;
}

export interface GreenLeafGuarantee {
  id: string;
  relatedDutyId: string;
  guaranteeNumber: string;
  chequeNumber: string;
  chequeBank: string;
  chequeDate: string;
  chequeAmount: number;
  isDelivered: boolean;
  cashAmount: number;
  cashBank?: string;
  cashDate?: string;
  part?: string;
  guaranteeBank?: string;
}

export interface GreenLeafTax {
  id: string;
  amount: number;
  part: string;
  bank: string;
  date: string;
}

export interface GreenLeafRoadToll {
  id: string;
  amount: number;
  part: string;
  bank: string;
  date: string;
}

export interface GreenLeafData {
  duties: GreenLeafCustomsDuty[];
  guarantees: GreenLeafGuarantee[];
  taxes: GreenLeafTax[];
  roadTolls: GreenLeafRoadToll[];
}

export interface ShippingPayment {
  id: string;
  part: string;
  amount: number;
  date: string;
  bank: string;
  description: string;
}

export interface InternalShippingData {
  payments: ShippingPayment[];
}

export interface AgentPayment {
  id: string;
  agentName: string;
  amount: number;
  bank: string;
  date: string;
  part: string;
  description: string;
}

export interface AgentData {
  payments: AgentPayment[];
}

export interface TradeRecord {
  id: string;
  company: string;
  fileNumber: string;
  orderNumber?: string;
  goodsName: string;
  registrationNumber?: string;
  registrationDate?: string;
  registrationExpiry?: string;
  sellerName: string;
  commodityGroup: string;
  mainCurrency: string;
  currencyAllocationType?: string;
  allocationCurrencyRank?: 'Type1' | 'Type2';
  operatingBank?: string;
  items: TradeItem[];
  freightCost: number;
  startDate: string;
  status: 'Active' | 'Completed';
  stages: Record<TradeStage, TradeStageData>;
  createdAt: number;
  createdBy: string;
  isArchived?: boolean;
  isPriority?: boolean;
  isCommitmentFulfilled?: boolean;
  
  licenseData?: { transactions: TradeTransaction[] };
  insuranceData?: {
    policyNumber: string;
    company: string;
    cost: number;
    bank: string;
    endorsements: InsuranceEndorsement[];
    isPaid?: boolean;
    paymentDate?: string;
  };
  currencyPurchaseData?: CurrencyPurchaseData;
  shippingDocuments?: ShippingDocument[];
  inspectionData?: InspectionData;
  clearanceData?: ClearanceData;
  greenLeafData?: GreenLeafData;
  internalShippingData?: InternalShippingData;
  agentData?: AgentData;
  exchangeRate?: number;
  fiscalYearId?: string;
}

export interface SecurityLog {
  id: string;
  rowNumber: number;
  date: string;
  shift: string;
  origin: string;
  entryTime: string;
  exitTime: string;
  driverName: string;
  plateNumber: string;
  goodsName: string;
  quantity: string;
  destination: string;
  receiver: string;
  workDescription: string;
  permitProvider: string;
  registrant: string;
  status: SecurityStatus;
  createdAt: number;
  approverSupervisor?: string;
  approverFactory?: string;
  approverCeo?: string;
  rejectionReason?: string;
}

export interface PersonnelDelay {
  id: string;
  date: string;
  personnelName: string;
  unit: string;
  arrivalTime: string;
  delayAmount: string;
  repeatCount: string;
  instruction?: string;
  registrant: string;
  status: SecurityStatus;
  createdAt: number;
  approverSupervisor?: string;
  approverFactory?: string;
  approverCeo?: string;
  rejectionReason?: string;
}

export interface SecurityIncident {
  id: string;
  reportNumber: string;
  date: string;
  subject: string;
  description: string;
  shift: string;
  registrant: string;
  witnesses?: string;
  status: SecurityStatus;
  createdAt: number;
  shiftManagerOpinion?: string;
  hrAction?: string;
  safetyAction?: string;
  approverSupervisor?: string;
  approverFactory?: string;
  approverCeo?: string;
  rejectionReason?: string;
}
