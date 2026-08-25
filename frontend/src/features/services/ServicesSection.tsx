import { ArrowRight, Search, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  createAdminService,
  createAdminServiceCategory,
  deleteAdminService,
  deleteAdminServiceCategory,
  updateAdminService,
  updateAdminServiceCategory,
  type AdminData,
  type MeasurementUnit,
  type ServiceCategoryInput,
  type ServiceInput
} from "../../api";
import { AdminModal, DataTable, InlineActions, Panel, StatusBadge } from "../../components/admin-ui";
import { formatPlainNumber, formatUnit } from "../../utils/format";

type DisplayPrice = {
  price: number;
  priceFrom?: number | null;
  priceTo?: number | null;
};

function canUseProductInProcedure(product: { purpose?: "sale" | "procedure" | "both" }) {
  return !product.purpose || product.purpose === "procedure" || product.purpose === "both";
}

function formatHryvnia(value: number) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)} ₴`;
}

function formatServicePrice(value: DisplayPrice) {
  const plainHryvnia = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  if (value.priceFrom !== null && value.priceFrom !== undefined && value.priceTo !== null && value.priceTo !== undefined) {
    return `${plainHryvnia.format(value.priceFrom)} - ${plainHryvnia.format(value.priceTo)} ₴`;
  }

  if (value.priceFrom !== null && value.priceFrom !== undefined) {
    return `from ${formatHryvnia(value.priceFrom)}`;
  }

  if (value.priceTo !== null && value.priceTo !== undefined) {
    return `up to ${formatHryvnia(value.priceTo)}`;
  }

  return formatHryvnia(value.price);
}

export function ServicesSection({
  services,
  categories,
  employees,
  products,
  runAction
}: {
  services: AdminData["services"];
  categories: AdminData["serviceCategories"];
  employees: AdminData["employees"];
  products: AdminData["products"];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [consumableFilter, setConsumableFilter] = useState("all");
  const [serviceSearch, setServiceSearch] = useState("");
  const [isCreatingService, setIsCreatingService] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [collapsedServiceGroups, setCollapsedServiceGroups] = useState<string[]>([]);
  const editingService = services.find((service) => service.id === editingServiceId) ?? null;
  const editingCategory = categories.find((category) => category.id === editingCategoryId) ?? null;
  const normalizedServiceSearch = serviceSearch.trim().toLowerCase();
  const filteredServices = services.filter((service) => {
    const matchesCategory = categoryFilter === "all" || (categoryFilter === "" ? service.categoryId === null : service.categoryId === categoryFilter);
    const matchesEmployee =
      employeeFilter === "all" || (employeeFilter === "" ? service.employeeIds.length === 0 : service.employeeIds.includes(employeeFilter));
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? service.active : !service.active);
    const matchesConsumables =
      consumableFilter === "all" || (consumableFilter === "configured" ? service.consumables.length > 0 : service.consumables.length === 0);
    const matchesSearch =
      normalizedServiceSearch.length === 0 ||
      [
        service.name,
        service.description ?? "",
        service.category?.name ?? "Uncategorized",
        service.active ? "active" : "disabled",
        service.employees.map((employee) => `${employee.name} ${employee.specialization ?? ""}`).join(" "),
        service.consumables.map((consumable) => `${consumable.productName} ${consumable.productCategory ?? ""}`).join(" ")
      ].some((value) => value.toLowerCase().includes(normalizedServiceSearch));

    return matchesCategory && matchesEmployee && matchesStatus && matchesConsumables && matchesSearch;
  });
  const serviceGroups = buildServiceGroups(filteredServices, categories, categoryFilter);
  const serviceSummary = useMemo(() => buildServiceSummary(services), [services]);

  function toggleServiceGroup(groupId: string) {
    setCollapsedServiceGroups((current) => (current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]));
  }

  function renderServiceActions(item: AdminData["services"][number]) {
    return (
      <InlineActions
        labels={[item.active ? "Disable" : "Enable", "Edit", ...(item.canDelete ? ["Delete"] : [])]}
        onAction={(label) => {
          if (label === "Edit") {
            setEditingServiceId(item.id);
            return;
          }

          if (label === "Delete") {
            void runAction(() => deleteAdminService(item.id));
            return;
          }

          void runAction(() => updateAdminService(item.id, { active: !item.active }));
        }}
      />
    );
  }

  return (
    <div className="admin-grid">
      <Panel title="Service categories" action="Add category" onAction={() => setIsCreatingCategory(true)} wide>
        <DataTable
          columns={["Name", "Description", "Status", "Actions"]}
          rows={categories.map((category) => [
            category.name,
            category.description ?? "no description",
            <StatusBadge status={category.active ? "active" : "disabled"} />,
            <InlineActions
              labels={[category.active ? "Disable" : "Enable", "Edit", "Delete"]}
              onAction={(label) => {
                if (label === "Edit") {
                  setEditingCategoryId(category.id);
                  return;
                }

                if (label === "Delete") {
                  void runAction(() => deleteAdminServiceCategory(category.id));
                  return;
                }

                void runAction(() => updateAdminServiceCategory(category.id, { active: !category.active }));
              }}
            />
          ])}
        />
      </Panel>
      <Panel title="Services" action="Add service" onAction={() => setIsCreatingService(true)} wide>
        <div className="service-summary-grid">
          <article>
            <span>Total services</span>
            <strong>{serviceSummary.total}</strong>
            <small>{filteredServices.length} visible with current filters</small>
          </article>
          <article>
            <span>Active</span>
            <strong>{serviceSummary.active}</strong>
            <small>{serviceSummary.disabled} disabled</small>
          </article>
          <article>
            <span>Assigned</span>
            <strong>{serviceSummary.assigned}</strong>
            <small>{serviceSummary.unassigned} without specialist</small>
          </article>
          <article>
            <span>Consumables</span>
            <strong>{serviceSummary.withConsumables}</strong>
            <small>{serviceSummary.withoutConsumables} without materials</small>
          </article>
        </div>
        <div className="table-toolbar">
          <label>
            <span>Search</span>
            <div className="admin-search table-search">
              <Search aria-hidden="true" size={17} />
              <input placeholder="Name, description, specialist, material" value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} />
            </div>
          </label>
          <label>
            <span>Category filter</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">All categories</option>
              <option value="">Uncategorized</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Specialist filter</span>
            <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
              <option value="all">All specialists</option>
              <option value="">Unassigned</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status filter</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <label>
            <span>Consumables filter</span>
            <select value={consumableFilter} onChange={(event) => setConsumableFilter(event.target.value)}>
              <option value="all">All services</option>
              <option value="configured">With consumables</option>
              <option value="not_set">Without consumables</option>
            </select>
          </label>
        </div>
        <div className="service-groups">
          {serviceGroups.length > 0 ? (
            serviceGroups.map((group) => {
              const isOpen = !collapsedServiceGroups.includes(group.id);

              return (
                <section className="service-group" key={group.id}>
                  <button
                    aria-expanded={isOpen}
                    className="service-group-toggle"
                    onClick={() => toggleServiceGroup(group.id)}
                    type="button"
                  >
                    <span className={isOpen ? "service-group-arrow open" : "service-group-arrow"}>
                      <ArrowRight aria-hidden="true" size={16} />
                    </span>
                    <strong>{group.name}</strong>
                    <span>{group.services.length} services</span>
                  </button>
                  {isOpen ? (
                    group.services.length > 0 ? (
                      <DataTable
                        columns={["Name", "Description", "Specialists", "Price", "Duration", "Consumables", "History", "Status", "Actions"]}
                        rows={group.services.map((item) => [
                          item.name,
                          item.description || "-",
                          item.employees.length > 0 ? item.employees.map((employee) => employee.name).join(", ") : "not assigned",
                          formatServicePrice(item),
                          `${item.duration} min`,
                          formatConsumables(item.consumables),
                          item.appointmentCount > 0 ? `${item.appointmentCount} appointments` : "no appointments",
                          <StatusBadge status={item.active ? "active" : "disabled"} />,
                          renderServiceActions(item)
                        ])}
                      />
                    ) : (
                      <div className="empty-state">No services in this category.</div>
                    )
                  ) : null}
                </section>
              );
            })
          ) : (
            <div className="empty-state">No services match the current filters.</div>
          )}
        </div>
      </Panel>
      {isCreatingCategory ? (
        <AdminModal title="New category" onClose={() => setIsCreatingCategory(false)}>
          <ServiceCategoryForm
            onCancel={() => setIsCreatingCategory(false)}
            onSubmit={(payload) =>
              runAction(async () => {
                await createAdminServiceCategory(payload);
                setIsCreatingCategory(false);
              })
            }
          />
        </AdminModal>
      ) : null}
      {editingCategory ? (
        <AdminModal title={`Edit category: ${editingCategory.name}`} onClose={() => setEditingCategoryId(null)}>
          <ServiceCategoryEditForm
            category={editingCategory}
            key={editingCategory.id}
            onCancel={() => setEditingCategoryId(null)}
            onSubmit={(payload) =>
              runAction(async () => {
                await updateAdminServiceCategory(editingCategory.id, payload);
                setEditingCategoryId(null);
              })
            }
          />
        </AdminModal>
      ) : null}
      {isCreatingService ? (
        <AdminModal title="New service" onClose={() => setIsCreatingService(false)}>
          <ServiceForm
            categories={categories}
            employees={employees}
            products={products}
            onCancel={() => setIsCreatingService(false)}
            onSubmit={(payload) =>
              runAction(async () => {
                await createAdminService(payload);
                setIsCreatingService(false);
              })
            }
          />
        </AdminModal>
      ) : null}
      {editingService ? (
        <AdminModal title={`Edit service: ${editingService.name}`} onClose={() => setEditingServiceId(null)}>
          <ServiceEditForm
            categories={categories}
            employees={employees}
            products={products}
            key={editingService.id}
            service={editingService}
            onCancel={() => setEditingServiceId(null)}
            onSubmit={(payload) =>
              runAction(async () => {
                await updateAdminService(editingService.id, payload);
                setEditingServiceId(null);
              })
            }
          />
        </AdminModal>
      ) : null}
    </div>
  );
}

function buildServiceGroups(
  services: AdminData["services"],
  categories: AdminData["serviceCategories"],
  categoryFilter: string
) {
  const uncategorizedServices = services.filter((service) => !service.categoryId);

  if (categoryFilter === "") {
    return [
      {
        id: "uncategorized",
        name: "Uncategorized",
        services: uncategorizedServices
      }
    ];
  }

  if (categoryFilter !== "all") {
    const selectedCategory = categories.find((category) => category.id === categoryFilter);

    if (!selectedCategory) {
      return [];
    }

    return [
      {
        id: selectedCategory.id,
        name: selectedCategory.name,
        services: services.filter((service) => service.categoryId === selectedCategory.id)
      }
    ];
  }

  const groups = categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      services: services.filter((service) => service.categoryId === category.id)
    }))
    .filter((group) => group.services.length > 0);

  if (uncategorizedServices.length > 0) {
    groups.push({
      id: "uncategorized",
      name: "Uncategorized",
      services: uncategorizedServices
    });
  }

  return groups;
}

function buildServiceSummary(services: AdminData["services"]) {
  return {
    total: services.length,
    active: services.filter((service) => service.active).length,
    disabled: services.filter((service) => !service.active).length,
    assigned: services.filter((service) => service.employeeIds.length > 0).length,
    unassigned: services.filter((service) => service.employeeIds.length === 0).length,
    withConsumables: services.filter((service) => service.consumables.length > 0).length,
    withoutConsumables: services.filter((service) => service.consumables.length === 0).length
  };
}
function ServiceCategoryForm({
  onCancel,
  onSubmit
}: {
  onCancel: () => void;
  onSubmit: (payload: ServiceCategoryInput) => Promise<void>;
}) {
  const [form, setForm] = useState({ name: "", description: "", active: true });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      name: form.name,
      description: form.description,
      active: form.active
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        <span>Name</span>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </label>
      <label>
        <span>Description</span>
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
      </label>
      <label className="checkbox-line">
        <input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
        <span>Active category</span>
      </label>
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="primary-button admin-submit" type="submit">
          Add category
        </button>
      </div>
    </form>
  );
}

function ServiceCategoryEditForm({
  category,
  onCancel,
  onSubmit
}: {
  category: AdminData["serviceCategories"][number];
  onCancel: () => void;
  onSubmit: (payload: ServiceCategoryInput) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: category.name,
    description: category.description ?? "",
    active: category.active
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      name: form.name,
      description: form.description,
      active: form.active
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        <span>Name</span>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </label>
      <label>
        <span>Description</span>
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
      </label>
      <label className="checkbox-line">
        <input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
        <span>Active category</span>
      </label>
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="primary-button admin-submit" type="submit">
          Save category
        </button>
      </div>
    </form>
  );
}

function ServiceForm({
  categories,
  employees,
  onCancel,
  products,
  onSubmit
}: {
  categories: AdminData["serviceCategories"];
  employees: AdminData["employees"];
  onCancel: () => void;
  products: AdminData["products"];
  onSubmit: (payload: ServiceInput) => Promise<void>;
}) {
  const [form, setForm] = useState({
    categoryId: categories[0]?.id ?? "",
    name: "",
    price: "0",
    priceFrom: "",
    priceTo: "",
    duration: "60",
    description: "",
    active: true,
    employeeIds: employees[0]?.id ? [employees[0].id] : [],
    consumables: [] as ConsumableFormItem[]
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      categoryId: form.categoryId,
      name: form.name,
      price: Number(form.price),
      priceFrom: optionalPriceInput(form.priceFrom),
      priceTo: optionalPriceInput(form.priceTo),
      duration: Number(form.duration),
      description: form.description,
      active: form.active,
      employeeIds: form.employeeIds,
      consumables: toConsumablePayload(form.consumables)
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        <span>Category</span>
        <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
          <option value="">Uncategorized</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Name</span>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </label>
      <label>
        <span>Base price</span>
        <input type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
      </label>
      <label>
        <span>Price from</span>
        <input type="number" min="0" value={form.priceFrom} onChange={(event) => setForm({ ...form, priceFrom: event.target.value })} />
      </label>
      <label>
        <span>Price to</span>
        <input type="number" min="0" value={form.priceTo} onChange={(event) => setForm({ ...form, priceTo: event.target.value })} />
      </label>
      <label>
        <span>Duration, min</span>
        <input type="number" min="1" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} required />
      </label>
      <label>
        <span>Description</span>
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
      </label>
      <EmployeeSelector
        employees={employees}
        selectedIds={form.employeeIds}
        onChange={(employeeIds) => setForm({ ...form, employeeIds })}
      />
      <ConsumableSelector
        items={form.consumables}
        products={products}
        onChange={(consumables) => setForm({ ...form, consumables })}
      />
      {form.employeeIds.length === 0 ? <small className="form-note">Assign at least one specialist so clients can book this service.</small> : null}
      <label className="checkbox-line">
        <input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
        <span>Active service</span>
      </label>
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="primary-button admin-submit" disabled={form.employeeIds.length === 0} type="submit">
          Add service
        </button>
      </div>
    </form>
  );
}

function ServiceEditForm({
  categories,
  employees,
  products,
  onCancel,
  onSubmit,
  service
}: {
  categories: AdminData["serviceCategories"];
  employees: AdminData["employees"];
  products: AdminData["products"];
  onCancel: () => void;
  onSubmit: (payload: ServiceInput) => Promise<void>;
  service: AdminData["services"][number];
}) {
  const [form, setForm] = useState({
    categoryId: service.categoryId ?? "",
    name: service.name,
    price: String(service.price),
    priceFrom: service.priceFrom === null ? "" : String(service.priceFrom),
    priceTo: service.priceTo === null ? "" : String(service.priceTo),
    duration: String(service.duration),
    description: service.description ?? "",
    active: service.active,
    employeeIds: service.employeeIds,
    consumables: service.consumables.map((consumable) => ({
      productId: consumable.productId,
      quantity: String(consumable.quantity),
      unit: consumable.unit
    })) as ConsumableFormItem[]
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      categoryId: form.categoryId,
      name: form.name,
      price: Number(form.price),
      priceFrom: optionalPriceInput(form.priceFrom),
      priceTo: optionalPriceInput(form.priceTo),
      duration: Number(form.duration),
      description: form.description,
      active: form.active,
      employeeIds: form.employeeIds,
      consumables: toConsumablePayload(form.consumables)
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        <span>Category</span>
        <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
          <option value="">Uncategorized</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Name</span>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </label>
      <label>
        <span>Base price</span>
        <input type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
      </label>
      <label>
        <span>Price from</span>
        <input type="number" min="0" value={form.priceFrom} onChange={(event) => setForm({ ...form, priceFrom: event.target.value })} />
      </label>
      <label>
        <span>Price to</span>
        <input type="number" min="0" value={form.priceTo} onChange={(event) => setForm({ ...form, priceTo: event.target.value })} />
      </label>
      <label>
        <span>Duration, min</span>
        <input type="number" min="1" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} required />
      </label>
      <label>
        <span>Description</span>
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
      </label>
      <EmployeeSelector
        employees={employees}
        selectedIds={form.employeeIds}
        onChange={(employeeIds) => setForm({ ...form, employeeIds })}
      />
      <ConsumableSelector
        items={form.consumables}
        products={products}
        onChange={(consumables) => setForm({ ...form, consumables })}
      />
      {form.employeeIds.length === 0 ? <small className="form-note">Assign at least one specialist so clients can book this service.</small> : null}
      <label className="checkbox-line">
        <input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
        <span>Active service</span>
      </label>
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="primary-button admin-submit" disabled={form.employeeIds.length === 0} type="submit">
          Save service
        </button>
      </div>
    </form>
  );
}

function EmployeeSelector({
  employees,
  onChange,
  selectedIds
}: {
  employees: AdminData["employees"];
  onChange: (employeeIds: string[]) => void;
  selectedIds: string[];
}) {
  function toggleEmployee(employeeId: string) {
    onChange(selectedIds.includes(employeeId) ? selectedIds.filter((id) => id !== employeeId) : [...selectedIds, employeeId]);
  }

  return (
    <div className="checkbox-group">
      <span>Specialists</span>
      {employees.length > 0 ? (
        employees.map((employee) => (
          <label className="checkbox-line" key={employee.id}>
            <input checked={selectedIds.includes(employee.id)} onChange={() => toggleEmployee(employee.id)} type="checkbox" />
            <span>{employee.specialization ? `${employee.name} · ${employee.specialization}` : employee.name}</span>
          </label>
        ))
      ) : (
        <small>No employees available. Add an employee before publishing the service.</small>
      )}
    </div>
  );
}

type ConsumableFormItem = {
  productId: string;
  quantity: string;
  unit: MeasurementUnit;
};

function ConsumableSelector({
  items,
  onChange,
  products
}: {
  items: ConsumableFormItem[];
  onChange: (items: ConsumableFormItem[]) => void;
  products: AdminData["products"];
}) {
  const availableProducts = products.filter(canUseProductInProcedure);
  const defaultProductId = availableProducts[0]?.id ?? "";

  function addItem() {
    if (!defaultProductId) {
      return;
    }

    onChange([...items, { productId: defaultProductId, quantity: "1", unit: "ml" }]);
  }

  function updateItem(index: number, patch: Partial<ConsumableFormItem>) {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="consumable-builder">
      <div className="consumable-builder-header">
        <span>Consumable cosmetics</span>
        <button className="secondary-button compact-button" disabled={!defaultProductId} onClick={addItem} type="button">
          Add item
        </button>
      </div>
      <small className="form-note">Internal service parameters for analytics. Clients do not see these values.</small>
      {availableProducts.length === 0 ? <small className="form-note">Add products for procedures first to use them as consumables.</small> : null}
      {items.map((item, index) => (
        <div className="consumable-row" key={`${item.productId}-${index}`}>
          <label>
            <span>Product</span>
            <select value={item.productId} onChange={(event) => updateItem(index, { productId: event.target.value })}>
              {availableProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {formatProductOption(product)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Amount</span>
            <input
              min="0.01"
              step="0.01"
              type="number"
              value={item.quantity}
              onChange={(event) => updateItem(index, { quantity: event.target.value })}
              required
            />
          </label>
          <label>
            <span>Unit</span>
            <select value={item.unit} onChange={(event) => updateItem(index, { unit: event.target.value as MeasurementUnit })}>
              <option value="ml">ml</option>
              <option value="gram">g</option>
            </select>
          </label>
          <button aria-label="Remove consumable" className="icon-only-button" onClick={() => removeItem(index)} title="Remove" type="button">
            <Trash2 aria-hidden="true" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

function toConsumablePayload(items: ConsumableFormItem[]): ServiceInput["consumables"] {
  return items
    .filter((item) => item.productId && Number(item.quantity) > 0)
    .map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity),
      unit: item.unit
    }));
}

function optionalPriceInput(value: string) {
  return value.trim() ? Number(value) : null;
}

function formatConsumables(consumables: AdminData["services"][number]["consumables"]) {
  if (consumables.length === 0) {
    return "not set";
  }

  return consumables.map((consumable) => `${consumable.productName}: ${consumable.quantity} ${formatUnit(consumable.unit)}`).join(", ");
}

function formatProductOption(product: AdminData["products"][number]) {
  const content = product.contentAmount ? ` · ${formatPlainNumber(product.contentAmount)} ${formatUnit(product.contentUnit)}/pack` : "";
  return `${product.name}${content} · stock ${formatProductStock(product)}`;
}

function formatProductStock(product: AdminData["products"][number]) {
  if (product.stockContentAmount !== null && product.stockPackageEquivalent !== null && product.contentUnit) {
    return `${formatPlainNumber(product.stockPackageEquivalent)} packs · ${formatPlainNumber(product.stockContentAmount)} ${formatUnit(product.contentUnit)}`;
  }

  return String(product.stock);
}
