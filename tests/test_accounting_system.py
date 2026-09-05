import unittest

from accounting_system import AccountingSystem, JournalLine


class AccountingSystemTests(unittest.TestCase):
    def setUp(self) -> None:
        self.system = AccountingSystem()

        self.system.add_account("1000", "Cash", "asset")
        self.system.add_account("1100", "Accounts Receivable", "asset")
        self.system.add_account("1200", "Inventory", "asset")
        self.system.add_account("2000", "Accounts Payable", "liability")
        self.system.add_account("3000", "Owner Equity", "equity")
        self.system.add_account("4000", "Sales Revenue", "income")
        self.system.add_account("5000", "Cost of Goods Sold", "expense")

        self.system.add_contact("C001", "Walk-in Customer", "customer")
        self.system.add_contact("S001", "Wood Supplier", "supplier")

        self.system.add_product("P001", "Dining Table", sale_price=200.0, purchase_price=120.0, stock_quantity=10)

    def test_sales_purchase_payment_and_reports(self) -> None:
        self.system.record_sale("C001", "P001", quantity=2)
        self.system.record_payment("C001", amount=400.0, direction="in")

        self.system.record_purchase("S001", "P001", quantity=5)
        self.system.record_payment("S001", amount=600.0, direction="out")

        self.system.add_budget("5000", amount=1200.0, period="2026-Q3")

        stock = self.system.stock_report()["P001"]
        self.assertEqual(stock["quantity"], 13)
        self.assertEqual(stock["inventory_value"], 1560.0)

        pnl = self.system.profit_and_loss_report()
        self.assertEqual(pnl["total_income"], 400.0)
        self.assertEqual(pnl["total_expenses"], 240.0)
        self.assertEqual(pnl["net_profit"], 160.0)

        balance_sheet = self.system.balance_sheet_report()
        self.assertEqual(balance_sheet["total_assets"], balance_sheet["total_liabilities_and_equity"])

        budget = self.system.budget_report(period="2026-Q3")
        self.assertEqual(len(budget), 1)
        self.assertEqual(budget[0]["account_code"], "5000")
        self.assertEqual(budget[0]["actual"], 240.0)
        self.assertEqual(budget[0]["variance"], 960.0)

    def test_rejects_unbalanced_journal(self) -> None:
        with self.assertRaises(ValueError):
            self.system.add_journal_entry(
                "Broken",
                [
                    JournalLine(account_code="1000", debit=10.0),
                    JournalLine(account_code="4000", credit=9.0),
                ],
            )


if __name__ == "__main__":
    unittest.main()
