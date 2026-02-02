
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

export interface User {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  role: UserRole | string;
  avatar?: string;
  phoneNumber?: string;
  telegramChatId?: string;
  baleChatId?: string;
  canManageTrade?: boolean;
  receiveNotifications?: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export interface CompanyBank {
  id: string;
  bankName: string;
  accountNumber: string;
  sheba?: string;
  formLayoutId?: string;
  internalTransferTemplateId?: string;
  enableDualPrint?: boolean;
  internalWithdrawalTemplateId?: string;
  internalDepositTemplateId?: string;
}

export interface Company {
  id: string;
  name: string;
  logo?: string;
  showInWarehouse?: boolean;
  banks?: CompanyBank[];
  letterhead?: string;
  registrationNumber?: string;
  nationalId?: string;
  address?: string;
  phone?: string;
  fax?: string;
  postalCode?: string;
  economicCode?: string;
}

export interface Contact {
  id: string;
  name: string;
  number: string;
  isGroup: boolean;
  baleId?: string;
}

export interface PrintField {
  id: string;
  key: string;
  label: string;
  x: number;
  y: number;
  width?: number;
  fontSize?: number;
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

export interface CustomRole {
  id: string;
  label: string;
}

export interface RolePermissions {
  canViewAll?: boolean;
  canEditOwn?: boolean;
  canDeleteOwn?: boolean;
  canCreatePaymentOrder?: boolean;
  canViewPaymentOrders?: boolean;
  canApproveFinancial?: boolean;
  canApproveManager?: boolean;
  canApproveCeo?: boolean;
  canEditAll?: boolean;
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
  [key: string]: boolean | undefined;
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
    companySequences?: Record<string, CompanySequenceConfig>;
    createdAt: number;
}

export interface ExitPermitGroupConfig {
    groupId: string;
    activeStatuses: string[];
}

export interface CompanyNotificationConfig {
    salesManager?: string;
    warehouseGroup?: string;
}

export interface DailySecurityMeta {
    dailyDescription?: string;
    morningGuard?: { name: string; entry: string; exit: string };
    eveningGuard?: { name: string; entry: string; exit: string };
    nightGuard?: { name: string; entry: string; exit: string };
    isFactoryDailyApproved?: boolean;
    isCeoDailyApproved?: boolean;
}

export interface SystemSettings {
  currentTrackingNumber: number;
  currentExitPermitNumber: number;
  companyNames: string[];
  companies?: Company[];
  defaultCompany?: string;
  bankNames?: string[];
  operatingBankNames?: string[];
  commodityGroups: string[];
  rolePermissions?: Record<string, RolePermissions>;
  customRoles?: CustomRole[];
  savedContacts?: Contact[];
  pwaIcon?: string;
  telegramBotToken?: string;
  telegramAdminId?: string;
  baleBotToken?: string;
  smsApiKey?: string;
  smsSenderNumber?: string;
  googleCalendarId?: string;
  whatsappNumber?: string;
  geminiApiKey?: string;
  warehouseSequences?: Record<string, number>;
  companyNotifications?: Record<string, CompanyNotificationConfig>;
  defaultWarehouseGroup?: string;
  defaultSalesManager?: string;
  insuranceCompanies?: string[];
  exitPermitNotificationGroup?: string;
  exitPermitSecondGroupConfig?: ExitPermitGroupConfig;
  printTemplates?: PrintTemplate[];
  fiscalYears?: FiscalYear[];
  activeFiscalYearId?: string;
  dailySecurityMeta?: Record<string, DailySecurityMeta>;
}

export enum PaymentMethod {
  TRANSFER = 'حواله بانکی',
  CHEQUE = 'چک',
  CASH = 'نقد',
  POS = 'کارتخوان',
  SHEBA = 'شبا',
  SATNA = 'ساتنا',
  PAYA = 'پایا',
  INTERNAL_TRANSFER = 'حواله داخلی'
}

export interface PaymentDetail {
  id: string;
  method: PaymentMethod;
  amount: number;
  chequeNumber?: string;
  bankName?: string;
  description?: string;
  chequeDate?: string;
  sheba?: string;
  recipientBank?: string;
  paymentId?: string;
  destinationAccount?: string;
  destinationOwner?: string;
  destinationBranch?: string;
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

export interface PaymentOrder {
  id: string;
  trackingNumber: number;
  date: string;
  payee: string;
  totalAmount: number;
  description: string;
  status: OrderStatus;
  requester: string;
  createdAt: number;
  updatedAt?: number;
  paymentDetails: PaymentDetail[];
  attachments?: { fileName: string, data: string }[];
  payingCompany?: string;
  paymentPlace?: string;
  approverFinancial?: string;
  approverManager?: string;
  approverCeo?: string;
  rejectionReason?: string;
  rejectedBy?: string;
  fiscalYearId?: string;
}

export enum ExitPermitStatus {
  PENDING_CEO = 'در انتظار تایید مدیرعامل',
  PENDING_FACTORY = 'در انتظار مدیر کارخانه',
  PENDING_WAREHOUSE = 'در انتظار تایید انبار',
  PENDING_SECURITY = 'در انتظار خروج',
  EXITED = 'خارج شده (بایگانی)',
  REJECTED = 'رد شده'
}

export interface ExitPermitItem {
  id: string;
  goodsName: string;
  cartonCount: number;
  weight: number;
  deliveredCartonCount?: number;
  deliveredWeight?: number;
}

export interface ExitPermitDestination {
  id: string;
  recipientName: string;
  address: string;
  phone: string;
}

export interface ExitPermit {
  id: string;
  permitNumber: number;
  date: string;
  company?: string;
  requester: string;
  items: ExitPermitItem[];
  destinations: ExitPermitDestination[];
  goodsName?: string;
  recipientName?: string;
  cartonCount?: number;
  weight?: number;
  destinationAddress?: string;
  plateNumber?: string;
  driverName?: string;
  description?: string;
  status: ExitPermitStatus;
  createdAt: number;
  updatedAt?: number;
  approverCeo?: string;
  approverFactory?: string;
  approverWarehouse?: string;
  approverSecurity?: string;
  exitTime?: string;
  rejectionReason?: string;
  rejectedBy?: string;
}

export interface WarehouseItem {
  id: string;
  name: string;
  code?: string;
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
  number: number;
  items: WarehouseTransactionItem[];
  createdAt: number;
  createdBy: string;
  proformaNumber?: string;
  recipientName?: string;
  driverName?: string;
  plateNumber?: string;
  destination?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  rejectionReason?: string;
  rejectedBy?: string;
  updatedAt?: number;
}

export enum SecurityStatus {
    PENDING_SUPERVISOR = 'در انتظار تایید سرپرست',
    PENDING_FACTORY = 'در انتظار تایید مدیر کارخانه',
    PENDING_CEO = 'در انتظار تایید مدیرعامل',
    ARCHIVED = 'بایگانی شده',
    REJECTED = 'رد شده'
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
}

export interface PersonnelDelay {
    id: string;
    date: string;
    personnelName: string;
    unit: string;
    arrivalTime: string;
    delayAmount: string;
    repeatCount: string;
    instruction: string;
    registrant: string;
    status: SecurityStatus;
    createdAt: number;
    approverSupervisor?: string;
    approverFactory?: string;
    approverCeo?: string;
}

export interface SecurityIncident {
    id: string;
    reportNumber: string;
    date: string;
    subject: string;
    description: string;
    shift: string;
    witnesses: string;
    registrant: string;
    status: SecurityStatus;
    createdAt: number;
    approverSupervisor?: string;
    approverFactory?: string;
    approverCeo?: string;
    shiftManagerOpinion?: string;
    hrAction?: string;
    safetyAction?: string;
    rejectionReason?: string;
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
    attachment?: { fileName: string, url: string };
    audioUrl?: string;
    replyTo?: { id: string, sender: string, message: string };
    isEdited?: boolean;
}

export interface ChatGroup {
    id: string;
    name: string;
    members: string[];
    createdBy: string;
}

export interface GroupTask {
    id: string;
    groupId: string;
    title: string;
    isCompleted: boolean;
    createdBy: string;
    createdAt: number;
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

export interface TradeStageData {
    stage: TradeStage;
    isCompleted: boolean;
    description: string;
    costRial: number;
    costCurrency: number;
    currencyType: string;
    attachments: { fileName: string, url: string }[];
    updatedAt: number;
    updatedBy: string;
    queueDate?: string;
    allocationDate?: string;
    allocationCode?: string;
    allocationExpiry?: string;
}

export interface CurrencyTranche {
    id: string;
    amount: number;
    currencyType: string;
    date: string;
    exchangeName?: string;
    brokerName?: string;
    rate?: number;
    rialAmount?: number;
    currencyFee?: number;
    isDelivered?: boolean;
    deliveryDate?: string;
    returnAmount?: number;
    returnDate?: string;
    receivedAmount?: number;
}

export interface GuaranteeCheque {
    amount: string;
    bank: string;
    chequeNumber: string;
    dueDate: string;
    isDelivered?: boolean;
}

export interface CurrencyPurchaseData {
    payments: any[];
    purchasedAmount: number;
    purchasedCurrencyType: string;
    tranches?: CurrencyTranche[];
    isDelivered?: boolean;
    deliveredAmount?: number;
    remittedAmount?: number;
    guaranteeCheque?: GuaranteeCheque;
    purchaseDate?: string;
    brokerName?: string;
    exchangeName?: string;
    deliveryDate?: string;
    recipientName?: string;
    deliveredCurrencyType?: string;
}

export interface InsuranceEndorsement {
    id: string;
    date: string;
    amount: number;
    description: string;
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
    attachments: { fileName: string, url: string }[];
    createdAt: number;
    createdBy: string;
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
    description?: string;
}

export interface InspectionPayment {
    id: string;
    part: string;
    amount: number;
    date: string;
    bank: string;
    description?: string;
}

export interface InspectionData {
    certificates: InspectionCertificate[];
    payments: InspectionPayment[];
    totalInvoiceAmount?: number;
    certificateNumber?: string;
    inspectionCompany?: string;
}

// Added missing trade-related interfaces
export interface TradeTransaction {
    id: string;
    date: string;
    amount: number;
    bank: string;
    description: string;
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
    chequeNumber?: string;
    chequeBank?: string;
    chequeDate?: string;
    chequeAmount?: number;
    isDelivered: boolean;
    cashAmount?: number;
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
    fileNumber: string;
    orderNumber?: string;
    goodsName: string;
    sellerName: string;
    commodityGroup: string;
    mainCurrency: string;
    company: string;
    items: TradeItem[];
    freightCost: number;
    status: 'Active' | 'Completed';
    isArchived?: boolean;
    stages: Record<string, TradeStageData>;
    startDate: string;
    createdAt: number;
    createdBy: string;
    registrationNumber?: string;
    registrationDate?: string;
    registrationExpiry?: string;
    currencyAllocationType?: string;
    allocationCurrencyRank?: 'Type1' | 'Type2';
    operatingBank?: string;
    isPriority?: boolean;
    licenseData?: { transactions: TradeTransaction[] };
    insuranceData?: {
        policyNumber: string;
        company: string;
        cost: number;
        bank: string;
        endorsements: InsuranceEndorsement[];
        isPaid: boolean;
        paymentDate: string;
    };
    currencyPurchaseData?: CurrencyPurchaseData;
    shippingDocuments?: ShippingDocument[];
    inspectionData?: InspectionData;
    clearanceData?: ClearanceData;
    greenLeafData?: GreenLeafData;
    internalShippingData?: InternalShippingData;
    agentData?: AgentData;
    isCommitmentFulfilled?: boolean;
    exchangeRate?: number;
}
