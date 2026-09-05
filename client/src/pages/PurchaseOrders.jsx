import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Plus,
  Search,
  Eye,
  Calendar,
  Building,
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

export function PurchaseOrders({ navigate }) {
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
      const data = await api.purchaseOrders.list();
      setOrders(data);
    } catch (err) {
      setError(err.message || 'Failed to load purchase orders.');
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesTab =
        activeTab === 'ALL' ||
        (activeTab === 'RFQ' && o.status === 'RFQ') ||
        (activeTab === 'PURCHASE ORDER' && o.status === 'PURCHASE ORDER');

      const matchesSearch =
        searchQuery === '' ||
        o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.vendorName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesTab && matchesSearch;
    });
  }, [orders, activeTab, searchQuery]);

  const tabs = [
    { id: 'ALL', label: 'All Purchases', count: orders.length },
    {
      id: 'RFQ',
      label: 'Requests for Quotation',
      count: orders.filter((o) => o.status === 'RFQ').length,
    },
    {
      id: 'PURCHASE ORDER',
      label: 'Purchase Orders',
      count: orders.filter((o) => o.status === 'PURCHASE ORDER').length,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        subtitle="Manage supplier procurement, raw timber/hardware orders, and vendor billing status."
        breadcrumbs={[{ label: 'Purchases' }, { label: 'Purchase Orders' }]}
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => navigate('/purchase-orders/new')}
          >
            New RFQ / Purchase Order
          </Button>
        }
      />

      {/* Tabs & Search */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search PO # or vendor..."
            prefix={<Search className="h-4 w-4" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="py-16">
          <LoadingSpinner size="lg" message="Loading purchase orders..." />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadOrders} />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No purchase orders found"
          description={
            searchQuery
              ? `No purchase orders matched "${searchQuery}".`
              : 'Create a request for quotation to procure goods from suppliers.'
          }
          actionText="Create Purchase Order"
          onAction={() => navigate('/purchase-orders/new')}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow hover={false}>
              <TableHead>PO Reference</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Order Date</TableHead>
              <TableHead>Order Status</TableHead>
              <TableHead>Billing Status</TableHead>
              <TableHead align="right">Total Amount</TableHead>
              <TableHead align="right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.map((order) => (
              <TableRow
                key={order.id}
                onClick={() => navigate(`/purchase-orders/${order.id}`)}
              >
                <TableCell>
                  <span className="font-bold text-indigo-950 hover:underline">
                    {order.orderNumber}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-semibold text-slate-900">
                    {order.vendorName}
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
                      order.billStatus === 'FULLY BILLED'
                        ? 'success'
                        : order.billStatus === 'WAITING BILLS'
                        ? 'warning'
                        : 'neutral'
                    }
                  >
                    {order.billStatus}
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
                      navigate(`/purchase-orders/${order.id}`);
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
