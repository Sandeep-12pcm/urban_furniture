import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Building,
  User,
  Mail,
  Phone,
  MapPin,
  Edit2,
  Trash2,
} from 'lucide-react';
import { api } from '../services/api';
import {
  Button,
  Input,
  Select,
  Modal,
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
  ConfirmDialog,
  useToast,
  Tabs,
} from '../components/ui';
import { formatCurrency } from '../utils/currency';

export function Contacts() {
  const { success, error: toastError } = useToast();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'CUSTOMER',
    email: '',
    phone: '',
    city: '',
    taxId: '',
    paymentTerms: '30 Days',
  });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Delete Confirm State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.contacts.list();
      setContacts(data);
    } catch (err) {
      setError(err.message || 'Failed to load contacts.');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    setEditingContact(null);
    setFormData({
      name: '',
      type: activeTab === 'VENDOR' ? 'VENDOR' : 'CUSTOMER',
      email: '',
      phone: '',
      city: '',
      taxId: '',
      paymentTerms: '30 Days',
    });
    setFormErrors({});
    setIsModalOpen(true);
  }

  function handleOpenEdit(contact) {
    setEditingContact(contact);
    setFormData({
      name: contact.name || '',
      type: contact.type || 'CUSTOMER',
      email: contact.email || '',
      phone: contact.phone || '',
      city: contact.city || '',
      taxId: contact.taxId || '',
      paymentTerms: contact.paymentTerms || '30 Days',
    });
    setFormErrors({});
    setIsModalOpen(true);
  }

  function validateForm() {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Contact name is required.';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSaveContact(e) {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      if (editingContact) {
        const updated = await api.contacts.update(editingContact.id, formData);
        setContacts((prev) =>
          prev.map((c) => (c.id === editingContact.id ? updated : c))
        );
        success(`Contact "${updated.name}" updated successfully.`);
      } else {
        const created = await api.contacts.create(formData);
        setContacts((prev) => [created, ...prev]);
        success(`Contact "${created.name}" created successfully.`);
      }
      setIsModalOpen(false);
    } catch (err) {
      toastError(err.message || 'Failed to save contact.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteContact() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.contacts.delete(deleteTarget.id);
      setContacts((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      success(`Contact "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
    } catch (err) {
      toastError(err.message || 'Failed to delete contact.');
    } finally {
      setDeleting(false);
    }
  }

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const matchesTab =
        activeTab === 'ALL' ||
        (activeTab === 'CUSTOMER' && c.type === 'CUSTOMER') ||
        (activeTab === 'VENDOR' && c.type === 'VENDOR');

      const matchesSearch =
        searchQuery === '' ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone && c.phone.includes(searchQuery));

      return matchesTab && matchesSearch;
    });
  }, [contacts, activeTab, searchQuery]);

  const tabs = [
    { id: 'ALL', label: 'All Contacts', count: contacts.length },
    {
      id: 'CUSTOMER',
      label: 'Customers',
      count: contacts.filter((c) => c.type === 'CUSTOMER').length,
    },
    {
      id: 'VENDOR',
      label: 'Vendors',
      count: contacts.filter((c) => c.type === 'VENDOR').length,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle="Manage client accounts, vendors, and commercial business partners."
        breadcrumbs={[{ label: 'Master Data' }, { label: 'Contacts' }]}
        actions={
          <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
            New Contact
          </Button>
        }
      />

      {/* Tabs & Search Bar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search contacts by name, email, city..."
            prefix={<Search className="h-4 w-4" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Content States */}
      {loading ? (
        <div className="py-16">
          <LoadingSpinner size="lg" message="Loading contacts directory..." />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadContacts} />
      ) : filteredContacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts found"
          description={
            searchQuery
              ? `No contacts matched "${searchQuery}". Try adjusting your search query.`
              : 'Add your first customer or vendor partner to begin invoicing.'
          }
          actionText={searchQuery ? 'Clear Search' : 'Add Contact'}
          onAction={searchQuery ? () => setSearchQuery('') : handleOpenCreate}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow hover={false}>
              <TableHead>Contact / Company</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Communication</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Payment Terms</TableHead>
              <TableHead align="right">Open Balance</TableHead>
              <TableHead align="right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-700">
                      {contact.type === 'VENDOR' ? (
                        <Building className="h-4 w-4 text-amber-600" />
                      ) : (
                        <User className="h-4 w-4 text-indigo-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{contact.name}</div>
                      {contact.taxId && (
                        <div className="text-[11px] text-slate-400">Tax ID: {contact.taxId}</div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={contact.type === 'VENDOR' ? 'warning' : 'primary'}>
                    {contact.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5 text-xs">
                    {contact.email && (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        <span>{contact.email}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        <span>{contact.phone}</span>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>{contact.city || '-'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-slate-600">{contact.paymentTerms}</span>
                </TableCell>
                <TableCell align="right">
                  <span
                    className={`font-semibold ${
                      contact.balance > 0 ? 'text-rose-600' : 'text-slate-700'
                    }`}
                  >
                    {formatCurrency(contact.balance)}
                  </span>
                </TableCell>
                <TableCell align="right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Edit2}
                      onClick={() => handleOpenEdit(contact)}
                      title="Edit contact"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      className="text-slate-400 hover:text-rose-600"
                      onClick={() => setDeleteTarget(contact)}
                      title="Delete contact"
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !saving && setIsModalOpen(false)}
        title={editingContact ? `Edit Contact: ${editingContact.name}` : 'New Contact'}
        description="Register a new customer or vendor in the system."
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveContact}
              loading={saving}
            >
              {editingContact ? 'Save Changes' : 'Create Contact'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveContact} className="space-y-4">
          <Input
            label="Contact / Company Name"
            placeholder="e.g. Acme Corporation"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Contact Type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              options={[
                { value: 'CUSTOMER', label: 'Customer (Client)' },
                { value: 'VENDOR', label: 'Vendor (Supplier)' },
              ]}
            />
            <Select
              label="Payment Terms"
              value={formData.paymentTerms}
              onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
              options={[
                { value: 'Immediate', label: 'Immediate Payment' },
                { value: '15 Days', label: '15 Days' },
                { value: '30 Days', label: '30 Days (Net 30)' },
                { value: '60 Days', label: '60 Days' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Email"
              type="email"
              placeholder="billing@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              error={formErrors.email}
            />
            <Input
              label="Phone Number"
              placeholder="+1 (555) 000-0000"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="City / Location"
              placeholder="New York, NY"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
            <Input
              label="Tax ID / VAT Number"
              placeholder="e.g. US-9876543"
              value={formData.taxId}
              onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteContact}
        loading={deleting}
        title="Delete Contact"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? All associated order history may be affected.`}
        confirmText="Delete Contact"
        variant="danger"
      />
    </div>
  );
}
