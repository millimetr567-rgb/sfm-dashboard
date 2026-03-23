import { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const useTranslation = () => useContext(LanguageContext);

const dictionary = {
  uz: {
    dashboard: "Boshqaruv Paneli",
    debt: "Qarzdorlik Sverkasi",
    new_order: "Yangi Buyurtma",
    crm: "Mijozlar (CRM)",
    history: "Buyurtmalar Tarixi",
    products: "Sklad / Mahsulotlar",
    agents: "Agentlar & Loglar",
    cash: "Kassa Operatsiyalari",
    settings: "Shaxsiy Sozlamalar",
    logout: "Chiqish",
    admin_panel: "Admin Paneli",
    welcome: "Xush Kelibsiz!",
    total_sales: "Jami Savdo",
    pending_debt: "Kutilayotgan Qarzlar",
    order_count: "Buyurtmalar Soni",
    active_clients: "Faol Mijozlar",
    sales_30d: "Oxirgi 30 kunlik savdo (USD)",
    loading: "Yuklanmoqda...",
    search: "Qidiruv...",
    add_new: "Yangi Qo'shish",
    action_save: "Saqlash",
    action_cancel: "Bekor qilish",
    action_delete: "O'chirish",
    action_edit: "Tahrirlash",
    
    orders: "Buyurtmalar",
    payments: "To'lovlar",
    client: "Mijoz",
    amount: "Summa",
    status: "Holati",
    date: "Sana",
    notes: "Izoh",
    method: "Usuli",
    confirm: "Tasdiqlash",
    reject: "Rad etish",
    approve: "Tasdiqlash",
    
    stock: "Sklad (Qoldiq)",
    price: "Narx",
    code: "Kod",
    group: "Guruh",
    cost: "Tannarx",
    sell: "Sotish",
    
    excel_import: "Excel Import",
    excel_export: "Excel Yuklash",
    template: "Namuna",
    
    balance: "Sof Qarz",
    limit: "Limit",
    address: "Manzil",
    phone: "Telefon",
    
    payment_rec: "To'lov qabul qilish",
    debt_write: "Qarzga yozish",
    approve_waiting: "Tasdiq kutilmoqda",
    confirmed: "Tasdiqlangan",
    rejected: "Rad etilgan",
    
    cart: "Savatcha",
    add_to_cart: "Savatga qo'shish",
    send_order: "Buyurtmani Yuborish",
    empty_cart: "Savatchangiz bo'sh",
    total: "Jami",
    qty: "Soni",
    available: "Mavjud",
    no_stock: "Skladda yetarli emas",
    order_success: "Buyurtma yuborildi!",
    
    system_log: "Tizim Jurnali",
    actor: "Kim tomonida",
    action: "Amal",
    info: "Ma'lumot",
    change_pass: "Parol O'zgartirish",
    new_pass: "Yangi Parol"
  },
  ru: {
    dashboard: "Панель Управления",
    debt: "Акт Сверки",
    new_order: "Новый Заказ",
    crm: "Клиенты (CRM)",
    history: "История Заказов",
    products: "Склад / Товары",
    agents: "Агенты и Логи",
    cash: "Кассовые Операции",
    settings: "Личные Настройки",
    logout: "Выйти",
    admin_panel: "Админ Панель",
    welcome: "Добро Пожаловать!",
    total_sales: "Общие Продажи",
    pending_debt: "Ожидаемые Долги",
    order_count: "Кол-во Заказов",
    active_clients: "Активные Клиенты",
    sales_30d: "Продажи за 30 дней (USD)",
    loading: "Загрузка...",
    search: "Поиск...",
    add_new: "Добавить",
    action_save: "Сохранить",
    action_cancel: "Отмена",
    action_delete: "Удалить",
    action_edit: "Изменить",
    
    orders: "Заказы",
    payments: "Платежи",
    client: "Клиент",
    amount: "Сумма",
    status: "Статус",
    date: "Дата",
    notes: "Примечание",
    method: "Способ",
    confirm: "Подтвердить",
    reject: "Отклонить",
    approve: "Одобрить",
    
    stock: "Склад (Остаток)",
    price: "Цена",
    code: "Код",
    group: "Группа",
    cost: "Себестоимость",
    sell: "Продажа",
    
    excel_import: "Импорт Excel",
    excel_export: "Экспорт Excel",
    template: "Шаблон",
    
    balance: "Чистый Долг",
    limit: "Лимит",
    address: "Адрес",
    phone: "Телефон",
    
    payment_rec: "Прием оплаты",
    debt_write: "Записать в долг",
    approve_waiting: "Ожидает подтверждения",
    confirmed: "Подтверждено",
    rejected: "Отклонено",
    
    cart: "Корзина",
    add_to_cart: "В корзину",
    send_order: "Отправить Заказ",
    empty_cart: "Корзина пуста",
    total: "Итого",
    qty: "Кол-во",
    available: "Доступно",
    no_stock: "Недостаточно на складе",
    order_success: "Заказ отправлен!",
    
    system_log: "Системный Журнал",
    actor: "Кем выполнено",
    action: "Действие",
    info: "Инфо",
    change_pass: "Сменить Пароль",
    new_pass: "Новый Пароль"
  },
  en: {
    dashboard: "Dashboard",
    debt: "Debt Statement",
    new_order: "New Order",
    crm: "Clients (CRM)",
    history: "Order History",
    products: "Stock / Products",
    agents: "Agents & Logs",
    cash: "Cash Register",
    settings: "Personal Settings",
    logout: "Logout",
    admin_panel: "Admin Panel",
    welcome: "Welcome!",
    total_sales: "Total Sales",
    pending_debt: "Pending Debts",
    order_count: "Order Count",
    active_clients: "Active Clients",
    sales_30d: "30-Day Sales (USD)",
    loading: "Loading...",
    search: "Search...",
    add_new: "Add New",
    action_save: "Save",
    action_cancel: "Cancel",
    action_delete: "Delete",
    action_edit: "Edit",
    
    orders: "Orders",
    payments: "Payments",
    client: "Client",
    amount: "Amount",
    status: "Status",
    date: "Date",
    notes: "Notes",
    method: "Method",
    confirm: "Confirm",
    reject: "Reject",
    approve: "Approve",
    
    stock: "Stock (Balance)",
    price: "Price",
    code: "Code",
    group: "Group",
    cost: "Cost Price",
    sell: "Sell Price",
    
    excel_import: "Import Excel",
    excel_export: "Export Excel",
    template: "Template",
    
    balance: "Net Balance",
    limit: "Credit Limit",
    address: "Address",
    phone: "Phone",
    
    payment_rec: "Accept Payment",
    debt_write: "Add to Debt",
    approve_waiting: "Awaiting Approval",
    confirmed: "Confirmed",
    rejected: "Rejected",
    
    cart: "Shopping Cart",
    add_to_cart: "Add to Cart",
    send_order: "Submit Order",
    empty_cart: "Your cart is empty",
    total: "Total",
    qty: "Qty",
    available: "Available",
    no_stock: "Not enough stock",
    order_success: "Order submitted!",
    
    system_log: "System Log",
    actor: "By Actor",
    action: "Action",
    info: "Info",
    change_pass: "Change Password",
    new_pass: "New Password"
  }
};

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'uz');

  useEffect(() => {
    localStorage.setItem('lang', lang);
  }, [lang]);

  const t = (key) => {
    return dictionary[lang]?.[key] || dictionary['uz'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
