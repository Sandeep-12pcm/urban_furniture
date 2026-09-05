import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  Eye,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
} from 'lucide-react';
import { api } from '../services/api';
import {
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  PageHeader,
  LoadingSpinner,
  EmptyState,
  ErrorState,
  Tabs,
} from '../components/ui';
import { formatCurrency, formatDate } from '../utils/currency';

export function SalesOrders({ navigate }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.salesOrders.list();
      setOrders(data);
    } catch (err) {
      setError(err.message || 'Failed to load sales orders.');
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesTab =
        activeTab === 'ALL' ||
        (activeTab === 'QUOTATION' && o.status === 'QUOTATION') ||
        (activeTab === 'CONFIRMED' && o.status === 'CONFIRMED') ||
        (activeTab === 'DONE' && o.status === 'DONE');

      const matchesSearch =
        searchQuery === '' ||
        o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customerName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesTab && matchesSearch;
    });
  }, [orders, activeTab, searchQuery]);

  const tabs = [
    { id: 'ALL', label: 'All Orders', count: orders.length },
    {
      id: 'QUOTATION',
      label: 'Quotations',
      count: orders.filter((o) => o.status === 'QUOTATION').length,
    },
    {
      id: 'CONFIRMED',
      label: 'Confirmed',
      count: orders.filter((o) => o.status === 'CONFIRMED').length,
    },
    {
      id: 'DONE',
      label: 'Completed / Invoiced',
      count: orders.filter((o) => o.status === 'DONE').length,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Sales Orders"
        subtitle="Manage customer quotations, confirmed furniture orders, and invoicing status."
        breadcrumbs={[{ label: 'Sales' }, { label: 'Sales Orders' }]}
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => navigate('/sales-orders/new')}
          >
            New Quotation / Order
          </Button>
        }
      />

      {/* Tabs & Search */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search order # or customer..."
            prefix={<Search className="h-4 w-4" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16">
          <LoadingSpinner size="lg" message="Loading sales orders..." />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadOrders} />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No sales orders found"
          description={
            searchQuery
              ? `No orders matched "${searchQuery}".`
              : 'Create a new quotation or sales order to begin.'
          }
          actionText="Create Sales Order"
          onAction={() => navigate('/sales-orders/new')}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow hover={false}>
              <TableHead>Order Number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Order Date</TableHead>
              <TableHead>Order Status</TableHead>
              <TableHead>Invoice Status</TableHead>
              <TableHead align="right">Total Amount</TableHead>
              <TableHead align="right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.map((order) => (
              <TableRow
                key={order.id}
                onClick={() => navigate(`/sales-orders/${order.id}`)}
              >
                <TableCell>
                  <span className="font-bold text-indigo-950 hover:underline">
                    {order.orderNumber}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-semibold text-slate-900">
                    {order.customerName}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-slate-600">
                    {formatDate(order.orderDate)}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge status={order.status} />
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      order.invoiceStatus === 'FULLY INVOICED'
                        ? 'success'
                        : order.invoiceStatus === 'TO INVOICE'
                        ? 'warning'
                        : 'neutral'
                    }
                  >
                    {order.invoiceStatus}
                  </Badge>
                </TableCell>
                <TableCell align="right">
                  <span className="font-bold text-slate-900">
                    {formatCurrency(order.total)}
                  </span>
                </TableCell>
                <TableCell align="right">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Eye}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/sales-orders/${order.id}`);
                    }}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
