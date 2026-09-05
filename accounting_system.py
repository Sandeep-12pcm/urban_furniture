from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Literal, Optional


AccountType = Literal["asset", "liability", "equity", "income", "expense"]
ContactType = Literal["customer", "supplier", "other"]


@dataclass(frozen=True)
class Contact:
    contact_id: str
    name: str
    contact_type: ContactType = "other"


@dataclass
class Product:
    product_id: str
    name: str
    sale_price: float
    purchase_price: float
    stock_quantity: float = 0.0


@dataclass(frozen=True)
class Account:
    code: str
    name: str
    account_type: AccountType


@dataclass(frozen=True)
class BudgetItem:
    account_code: str
    amount: float
    period: Optional[str] = None


@dataclass(frozen=True)
class JournalLine:
    account_code: str
    debit: float = 0.0
    credit: float = 0.0


@dataclass(frozen=True)
class JournalEntry:
    description: str
    lines: List[JournalLine]


@dataclass
class AccountingSystem:
    contacts: Dict[str, Contact] = field(default_factory=dict)
    products: Dict[str, Product] = field(default_factory=dict)
    accounts: Dict[str, Account] = field(default_factory=dict)
    budgets: List[BudgetItem] = field(default_factory=list)
    journals: List[JournalEntry] = field(default_factory=list)
    ledger: Dict[str, Dict[str, float]] = field(default_factory=dict)

    receivable_account: str = "1100"
    inventory_account: str = "1200"
    cash_account: str = "1000"
    payable_account: str = "2000"
    revenue_account: str = "4000"
    cogs_account: str = "5000"

    def add_contact(self, contact_id: str, name: str, contact_type: ContactType = "other") -> None:
        self.contacts[contact_id] = Contact(contact_id, name, contact_type)

    def add_product(self, product_id: str, name: str, sale_price: float, purchase_price: float, stock_quantity: float = 0.0) -> None:
        self.products[product_id] = Product(product_id, name, sale_price, purchase_price, stock_quantity)

    def add_account(self, code: str, name: str, account_type: AccountType) -> None:
        self.accounts[code] = Account(code, name, account_type)
        self.ledger.setdefault(code, {"debit": 0.0, "credit": 0.0})

    def add_budget(self, account_code: str, amount: float, period: Optional[str] = None) -> None:
        self._require_account(account_code)
        self.budgets.append(BudgetItem(account_code=account_code, amount=amount, period=period))

    def add_journal_entry(self, description: str, lines: List[JournalLine]) -> None:
        total_debit = round(sum(line.debit for line in lines), 2)
        total_credit = round(sum(line.credit for line in lines), 2)
        if total_debit != total_credit:
            raise ValueError("Journal entry is unbalanced")

        for line in lines:
            self._require_account(line.account_code)

        entry = JournalEntry(description=description, lines=lines)
        self.journals.append(entry)

        for line in lines:
            balance = self.ledger.setdefault(line.account_code, {"debit": 0.0, "credit": 0.0})
            balance["debit"] += line.debit
            balance["credit"] += line.credit

    def record_sale(self, contact_id: str, product_id: str, quantity: float, unit_price: Optional[float] = None) -> None:
        contact = self._require_contact(contact_id)
        if contact.contact_type not in {"customer", "other"}:
            raise ValueError("Sales can only be recorded against customers")

        product = self._require_product(product_id)
        if quantity <= 0:
            raise ValueError("Quantity must be positive")
        if product.stock_quantity < quantity:
            raise ValueError("Insufficient stock")

        price = unit_price if unit_price is not None else product.sale_price
        revenue = round(quantity * price, 2)
        cogs = round(quantity * product.purchase_price, 2)
        product.stock_quantity -= quantity

        self.add_journal_entry(
            description=f"Sale: {contact.name} - {product.name}",
            lines=[
                JournalLine(account_code=self.receivable_account, debit=revenue),
                JournalLine(account_code=self.revenue_account, credit=revenue),
                JournalLine(account_code=self.cogs_account, debit=cogs),
                JournalLine(account_code=self.inventory_account, credit=cogs),
            ],
        )

    def record_purchase(self, contact_id: str, product_id: str, quantity: float, unit_cost: Optional[float] = None) -> None:
        contact = self._require_contact(contact_id)
        if contact.contact_type not in {"supplier", "other"}:
            raise ValueError("Purchases can only be recorded against suppliers")

        product = self._require_product(product_id)
        if quantity <= 0:
            raise ValueError("Quantity must be positive")

        cost = unit_cost if unit_cost is not None else product.purchase_price
        amount = round(quantity * cost, 2)
        product.stock_quantity += quantity

        self.add_journal_entry(
            description=f"Purchase: {contact.name} - {product.name}",
            lines=[
                JournalLine(account_code=self.inventory_account, debit=amount),
                JournalLine(account_code=self.payable_account, credit=amount),
            ],
        )

    def record_payment(self, contact_id: str, amount: float, direction: Literal["in", "out"]) -> None:
        self._require_contact(contact_id)
        if amount <= 0:
            raise ValueError("Amount must be positive")

        if direction == "in":
            lines = [
                JournalLine(account_code=self.cash_account, debit=amount),
                JournalLine(account_code=self.receivable_account, credit=amount),
            ]
        elif direction == "out":
            lines = [
                JournalLine(account_code=self.payable_account, debit=amount),
                JournalLine(account_code=self.cash_account, credit=amount),
            ]
        else:
            raise ValueError("direction must be either 'in' or 'out'")

        self.add_journal_entry(description=f"Payment ({direction}): {contact_id}", lines=lines)

    def profit_and_loss_report(self) -> Dict[str, object]:
        income = self._account_group_totals("income")
        expenses = self._account_group_totals("expense")
        total_income = round(sum(income.values()), 2)
        total_expenses = round(sum(expenses.values()), 2)

        return {
            "income": income,
            "expenses": expenses,
            "total_income": total_income,
            "total_expenses": total_expenses,
            "net_profit": round(total_income - total_expenses, 2),
        }

    def balance_sheet_report(self) -> Dict[str, object]:
        assets = self._account_group_totals("asset")
        liabilities = self._account_group_totals("liability")
        equity = self._account_group_totals("equity")
        net_profit = self.profit_and_loss_report()["net_profit"]

        total_assets = round(sum(assets.values()), 2)
        total_liabilities = round(sum(liabilities.values()), 2)
        base_equity = round(sum(equity.values()), 2)
        total_equity = round(base_equity + net_profit, 2)

        return {
            "assets": assets,
            "liabilities": liabilities,
            "equity": {**equity, "current_period_earnings": net_profit},
            "total_assets": total_assets,
            "total_liabilities_and_equity": round(total_liabilities + total_equity, 2),
        }

    def budget_report(self, period: Optional[str] = None) -> List[Dict[str, object]]:
        report: List[Dict[str, object]] = []

        for budget in self.budgets:
            if period is not None and budget.period != period:
                continue
            actual = self._normalized_balance(budget.account_code)
            report.append(
                {
                    "account_code": budget.account_code,
                    "account_name": self.accounts[budget.account_code].name,
                    "period": budget.period,
                    "budget": round(budget.amount, 2),
                    "actual": round(actual, 2),
                    "variance": round(budget.amount - actual, 2),
                }
            )

        return report

    def stock_report(self) -> Dict[str, Dict[str, float]]:
        return {
            product.product_id: {
                "name": product.name,
                "quantity": round(product.stock_quantity, 2),
                "inventory_value": round(product.stock_quantity * product.purchase_price, 2),
            }
            for product in self.products.values()
        }

    def _require_contact(self, contact_id: str) -> Contact:
        if contact_id not in self.contacts:
            raise KeyError(f"Contact {contact_id} not found")
        return self.contacts[contact_id]

    def _require_product(self, product_id: str) -> Product:
        if product_id not in self.products:
            raise KeyError(f"Product {product_id} not found")
        return self.products[product_id]

    def _require_account(self, account_code: str) -> None:
        if account_code not in self.accounts:
            raise KeyError(f"Account {account_code} not found")

    def _raw_balance(self, account_code: str) -> float:
        self._require_account(account_code)
        movement = self.ledger.get(account_code, {"debit": 0.0, "credit": 0.0})
        return movement["debit"] - movement["credit"]

    def _normalized_balance(self, account_code: str) -> float:
        account = self.accounts[account_code]
        raw = self._raw_balance(account_code)
        if account.account_type in {"asset", "expense"}:
            return raw
        return -raw

    def _account_group_totals(self, account_type: AccountType) -> Dict[str, float]:
        totals: Dict[str, float] = {}
        for account in self.accounts.values():
            if account.account_type != account_type:
                continue
            totals[account.code] = round(self._normalized_balance(account.code), 2)
        return totals
