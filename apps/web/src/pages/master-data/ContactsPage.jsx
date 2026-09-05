import { Archive, Eye, Loader2, Pencil, Plus, RotateCcw, Save, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { EmptyState, ErrorState, LoadingTable } from '../../components/DataStates.jsx';
import { FormField } from '../../components/FormField.jsx';
import { Input } from '../../components/Input.jsx';
import { Modal } from '../../components/Modal.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { RowActionButton, RowActions } from '../../components/RowActions.jsx';
import { Select } from '../../components/Select.jsx';
import { StatusBadge, TypeBadge } from '../../components/StatusBadge.jsx';
import { Table, Td, Th, Tr } from '../../components/Table.jsx';
import { FilterSelect, SearchBar, Toolbar } from '../../components/Toolbar.jsx';
import { useToast } from '../../components/Toast.jsx';
import { canArchiveMasterData, useAuth } from '../../lib/AuthContext.jsx';
import { contactsApi } from '../../lib/masterDataApi.js';
import { validateContactForm } from '../../lib/masterDataValidation.js';
import { useDebouncedValue, useResourceList } from '../../lib/useResourceList.js';

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'All Types' },
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'VENDOR', label: 'Vendor' },
  { value: 'BOTH', label: 'Both' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'ALL', label: 'All' },
];

export function ContactsPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const canArchive = canArchiveMasterData(user.role);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  const [formState, setFormState] = useState(null); // null | 'create' | contact object to edit
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [restoringId, setRestoringId] = useState('');

  const params = {
    search: debouncedSearch || undefined,
    type: typeFilter === 'ALL' ? undefined : typeFilter,
    status: statusFilter,
    page,
    limit: 30,
  };

  const { data: contacts, pagination, loading, error, reload } = useResourceList(contactsApi, params, 'contacts');

  async function handleArchive() {
    setArchiving(true);
    try {
      await contactsApi.archive(archiveTarget.id);
      notify(`"${archiveTarget.name}" was archived.`);
      setArchiveTarget(null);
      reload();
    } catch (requestError) {
      notify(requestError.message || 'Could not archive contact.', { tone: 'error' });
    } finally {
      setArchiving(false);
    }
  }

  async function handleRestore(contact) {
    setRestoringId(contact.id);
    try {
      await contactsApi.restore(contact.id);
      notify(`"${contact.name}" was restored.`);
      reload();
    } catch (requestError) {
      notify(requestError.message || 'Could not restore contact.', { tone: 'error' });
    } finally {
      setRestoringId('');
    }
  }

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle="Manage customers and vendors"
        actions={
          <Button type="button" onClick={() => setFormState('create')}>
            <Plus className="h-4 w-4" />
            Add Contact
          </Button>
        }
      />

      <div className="rounded-2xl border border-white/80 bg-white p-5 shadow-card">
        <Toolbar>
          <SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search contacts…" />
          <div className="flex gap-3">
            <FilterSelect label="Filter by type" value={typeFilter} onChange={(value) => { setTypeFilter(value); setPage(1); }} options={TYPE_OPTIONS} />
            <FilterSelect label="Filter by status" value={statusFilter} onChange={(value) => { setStatusFilter(value); setPage(1); }} options={STATUS_OPTIONS} />
          </div>
        </Toolbar>

        {loading && <LoadingTable columns={6} />}
        {!loading && error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && contacts.length === 0 && (
          <EmptyState
            icon={Users}
            title="No contacts found."
            description="Add your first customer or vendor to get started."
            action={
              <Button type="button" onClick={() => setFormState('create')}>
                <Plus className="h-4 w-4" />
                Add Contact
              </Button>
            }
          />
        )}

        {!loading && !error && contacts.length > 0 && (
          <Table minWidth="820px">
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Email</Th>
                <Th>Mobile</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <Tr key={contact.id}>
                  <Td first className="font-semibold">{contact.name}</Td>
                  <Td><TypeBadge type={contact.type} /></Td>
                  <Td className="text-muted">{contact.email || '—'}</Td>
                  <Td className="text-muted">{contact.mobile || '—'}</Td>
                  <Td><StatusBadge status={contact.status} /></Td>
                  <Td last>
                    <RowActions>
                      <Link to={`/master-data/contacts/${contact.id}`}>
                        <RowActionButton label="View contact" icon={Eye} onClick={() => {}} />
                      </Link>
                      <RowActionButton label="Edit contact" icon={Pencil} onClick={() => setFormState(contact)} />
                      {contact.status === 'ACTIVE' && canArchive && (
                        <RowActionButton label="Archive contact" icon={Archive} tone="danger" onClick={() => setArchiveTarget(contact)} />
                      )}
                      {contact.status === 'ARCHIVED' && canArchive && (
                        <RowActionButton
                          label="Restore contact"
                          icon={restoringId === contact.id ? Loader2 : RotateCcw}
                          onClick={() => handleRestore(contact)}
                        />
                      )}
                    </RowActions>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}

        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>

      <ContactFormModal
        open={Boolean(formState)}
        contact={formState && formState !== 'create' ? formState : null}
        onClose={() => setFormState(null)}
        onSaved={() => {
          setFormState(null);
          reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archive contact?"
        description={`"${archiveTarget?.name}" will be moved to Archived and hidden from new transactions. You can restore it later.`}
        confirmLabel="Archive"
        loading={archiving}
        onConfirm={handleArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}

function ContactFormModal({ open, contact, onClose, onSaved }) {
  const { notify } = useToast();
  const isEdit = Boolean(contact);
  const [form, setForm] = useState(() => toFormState(contact));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  function toFormState(existing) {
    return {
      name: existing?.name || '',
      type: existing?.type || 'CUSTOMER',
      email: existing?.email || '',
      mobile: existing?.mobile || '',
      city: existing?.city || '',
      state: existing?.state || '',
      pincode: existing?.pincode || '',
      profileImageUrl: existing?.profileImageUrl || '',
      createPortalAccount: false,
      portalLoginId: '',
      portalEmail: '',
      portalPassword: '',
    };
  }

  useEffect(() => {
    if (open) {
      setForm(toFormState(contact));
      setErrors({});
      setSubmitError('');
    }
    // toFormState is a pure function of `contact`; re-running only on open/contact avoids resetting mid-edit.

  }, [open, contact]);

  async function submit(event) {
    event.preventDefault();
    const validationErrors = validateContactForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        email: form.email.trim() || undefined,
        mobile: form.mobile.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        pincode: form.pincode.trim() || undefined,
        profileImageUrl: form.profileImageUrl.trim() || undefined,
      };

      if (isEdit) {
        await contactsApi.update(contact.id, payload);
        notify('Contact updated successfully.');
      } else {
        if (form.createPortalAccount) {
          payload.createPortalAccount = true;
          payload.portalAccount = {
            loginId: form.portalLoginId.trim(),
            email: form.portalEmail.trim(),
            password: form.portalPassword,
          };
        }
        await contactsApi.create(payload);
        notify('Contact created successfully.');
      }
      onSaved();
    } catch (requestError) {
      setSubmitError(requestError.message || 'Could not save contact.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title={isEdit ? 'Edit Contact' : 'Add Contact'}
      subtitle={isEdit ? contact?.name : 'Create a customer or vendor record.'}
      onClose={onClose}
      width="max-w-xl"
    >
      <FormBody
        key={contact?.id || 'create'}
        form={form}
        setForm={setForm}
        errors={errors}
        isEdit={isEdit}
        submitError={submitError}
        submitting={submitting}
        onCancel={onClose}
        onSubmit={submit}
      />
    </Modal>
  );
}

function FormBody({ form, setForm, errors, isEdit, submitError, submitting, onCancel, onSubmit }) {
  function set(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Name" required error={errors.name}>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Nimesh Pathak" />
        </FormField>
        <FormField label="Type" required error={errors.type}>
          <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
            <option value="CUSTOMER">Customer</option>
            <option value="VENDOR">Vendor</option>
            <option value="BOTH">Both</option>
          </Select>
        </FormField>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Email" error={errors.email}>
          <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@example.com" />
        </FormField>
        <FormField label="Mobile" error={errors.mobile}>
          <Input value={form.mobile} onChange={(e) => set('mobile', e.target.value)} placeholder="98765 43210" />
        </FormField>
      </div>

      <FormField label="Profile Image URL" hint="Optional link to a hosted profile photo.">
        <Input value={form.profileImageUrl} onChange={(e) => set('profileImageUrl', e.target.value)} placeholder="https://…" />
      </FormField>

      <fieldset className="rounded-xl border border-borderSoft p-4">
        <legend className="px-1 text-sm font-bold text-ink">Address</legend>
        <div className="grid gap-5 sm:grid-cols-3">
          <FormField label="City">
            <Input value={form.city} onChange={(e) => set('city', e.target.value)} />
          </FormField>
          <FormField label="State">
            <Input value={form.state} onChange={(e) => set('state', e.target.value)} />
          </FormField>
          <FormField label="Pincode" error={errors.pincode}>
            <Input value={form.pincode} onChange={(e) => set('pincode', e.target.value)} placeholder="400001" />
          </FormField>
        </div>
      </fieldset>

      {!isEdit && (
        <fieldset className="rounded-xl border border-borderSoft p-4">
          <label className="flex items-center gap-3 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-borderSoft text-navy focus:ring-indigo"
              checked={form.createPortalAccount}
              onChange={(e) => set('createPortalAccount', e.target.checked)}
            />
            Create Portal Account
          </label>
          <p className="mt-1 pl-7 text-xs text-muted">Gives this contact a CONTACT-role login for the future Contact Portal.</p>

          {form.createPortalAccount && (
            <div className="mt-4 grid gap-5 pl-7 sm:grid-cols-2">
              <FormField label="Portal Login ID" required error={errors.portalLoginId}>
                <Input value={form.portalLoginId} onChange={(e) => set('portalLoginId', e.target.value)} />
              </FormField>
              <FormField label="Portal Email" required error={errors.portalEmail}>
                <Input type="email" value={form.portalEmail} onChange={(e) => set('portalEmail', e.target.value)} />
              </FormField>
              <FormField label="Portal Password" required error={errors.portalPassword} hint="At least 8 characters.">
                <Input type="password" value={form.portalPassword} onChange={(e) => set('portalPassword', e.target.value)} />
              </FormField>
            </div>
          )}
        </fieldset>
      )}

      {submitError && <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{submitError}</div>}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isEdit ? 'Save Changes' : 'Create Contact'}
        </Button>
      </div>
    </form>
  );
}
