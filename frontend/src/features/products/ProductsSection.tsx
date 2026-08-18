import { Package, Search } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createAdminProduct,
  createAdminProductBrand,
  createAdminProductCategory,
  createAdminStockMovement,
  deleteAdminProduct,
  deleteAdminProductBrand,
  deleteAdminProductCategory,
  updateAdminProduct,
  updateAdminProductBrand,
  updateAdminProductCategory,
  uploadAdminProductImage,
  type AdminData,
  type MeasurementUnit,
  type ProductBrandInput,
  type ProductCategoryInput,
  type ProductInput,
  type ProductPurpose,
  type StockMovementInput
} from "../../api";
import { AdminModal, DataTable, InlineActions, PaginationControls, Panel, StatusBadge } from "../../components/admin-ui";
import { adminMoney, formatPlainNumber, formatUnit } from "../../utils/format";

type StockMovementHistoryRow = {
  id: string;
  amount: string;
  brand: string | null;
  category: string;
  createdAt: string;
  product: string;
  reason: string | null;
  type: string;
};

const today = new Date().toISOString().slice(0, 10);
const PRODUCTS_PAGE_SIZE = 7;
const STOCK_MOVEMENT_PAGE_SIZE = 8;

export function ProductsSection({
  brands,
  categories,
  products,
  runAction
}: {
  brands: AdminData["productBrands"];
  categories: AdminData["productCategories"];
  products: AdminData["products"];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [isCreatingBrand, setIsCreatingBrand] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [isCreatingStockMovement, setIsCreatingStockMovement] = useState(false);
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [productBrandFilter, setProductBrandFilter] = useState("all");
  const [productPurposeFilter, setProductPurposeFilter] = useState("all");
  const [productSearch, setProductSearch] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [isViewingStockHistory, setIsViewingStockHistory] = useState(false);
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const editingBrand = brands.find((brand) => brand.id === editingBrandId) ?? null;
  const editingCategory = categories.find((category) => category.id === editingCategoryId) ?? null;
  const editingProduct = products.find((product) => product.id === editingProductId) ?? null;
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null;
  const normalizedProductSearch = productSearch.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      productCategoryFilter === "all" ||
      (productCategoryFilter === "" ? product.categoryId === null : product.categoryId === productCategoryFilter);
    const matchesBrand = productBrandFilter === "all" || (productBrandFilter === "" ? product.brandId === null : product.brandId === productBrandFilter);
    const matchesPurpose = productPurposeFilter === "all" || product.purpose === productPurposeFilter;
    const matchesSearch =
      normalizedProductSearch.length === 0 ||
      [product.name, product.category, product.brand ?? "", product.sku ?? "", product.description ?? "", formatProductPurpose(product.purpose)].some((value) =>
        value.toLowerCase().includes(normalizedProductSearch)
      );

    return matchesCategory && matchesBrand && matchesPurpose && matchesSearch;
  });
  const productPageCount = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PAGE_SIZE));
  const currentProductPage = Math.min(productPage, productPageCount);
  const pagedProducts = filteredProducts.slice((currentProductPage - 1) * PRODUCTS_PAGE_SIZE, currentProductPage * PRODUCTS_PAGE_SIZE);
  const stockMovementRows = buildStockMovementHistoryRows(products);
  const latestStockMovementRows = stockMovementRows.slice(0, 4);
  const inventorySummary = useMemo(() => buildInventorySummary(products), [products]);

  useEffect(() => {
    setProductPage(1);
  }, [productBrandFilter, productCategoryFilter, productPurposeFilter, productSearch]);

  return (
    <div className="admin-grid">
      <Panel title="Catalog setup" wide>
        <div className="compact-management-grid">
          <section className="compact-management-card">
            <div className="compact-management-header">
              <div>
                <p className="admin-kicker">Categories</p>
                <strong>{categories.length}</strong>
              </div>
              <button className="panel-action" onClick={() => setIsCreatingCategory(true)} type="button">
                + Add category
              </button>
            </div>
            <DataTable
              columns={["Photo", "Category", "Products", "Actions"]}
              rows={
                categories.length > 0
                  ? categories.map((category) => [
                      <span className="product-category-thumb">{category.imageUrl ? <img alt="" src={category.imageUrl} /> : <Package aria-hidden="true" size={16} />}</span>,
                      category.name,
                      String(category.productCount),
                      <InlineActions
                        labels={["Edit", "Delete"]}
                        onAction={(label) => {
                          if (label === "Edit") {
                            setEditingCategoryId(category.id);
                            return;
                          }

                          void runAction(() => deleteAdminProductCategory(category.id));
                        }}
                      />
                    ])
                  : [["-", "No categories yet", "-", "-"]]
              }
            />
          </section>

          <section className="compact-management-card">
            <div className="compact-management-header">
              <div>
                <p className="admin-kicker">Brands</p>
                <strong>{brands.length}</strong>
              </div>
              <button className="panel-action" onClick={() => setIsCreatingBrand(true)} type="button">
                + Add brand
              </button>
            </div>
            <DataTable
              columns={["Brand", "Products", "Actions"]}
              rows={
                brands.length > 0
                  ? brands.map((brand) => [
                      brand.name,
                      String(brand.productCount),
                      <InlineActions
                        labels={["Edit", "Delete"]}
                        onAction={(label) => {
                          if (label === "Edit") {
                            setEditingBrandId(brand.id);
                            return;
                          }

                          void runAction(() => deleteAdminProductBrand(brand.id));
                        }}
                      />
                    ])
                  : [["No brands yet", "-", "-"]]
              }
            />
          </section>
        </div>
      </Panel>
      <Panel title="Products / inventory" action="Add product" onAction={() => setIsCreatingProduct(true)} wide>
        <div className="inventory-summary-grid">
          <article>
            <span>Total products</span>
            <strong>{inventorySummary.totalProducts}</strong>
            <small>{inventorySummary.trackedProducts} tracked in stock</small>
          </article>
          <article>
            <span>Low stock</span>
            <strong>{inventorySummary.lowStockProducts}</strong>
            <small>{inventorySummary.outOfStockProducts} out of stock</small>
          </article>
          <article>
            <span>Procedure materials</span>
            <strong>{inventorySummary.procedureProducts}</strong>
            <small>Products used in services</small>
          </article>
          <article>
            <span>Retail stock value</span>
            <strong>{adminMoney.format(inventorySummary.retailValue)}</strong>
            <small>Estimated by sale price</small>
          </article>
        </div>
        <div className="table-toolbar">
          <label>
            <span>Search</span>
            <div className="admin-search table-search">
              <Search aria-hidden="true" size={17} />
              <input placeholder="Name, SKU, brand" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} />
            </div>
          </label>
          <label>
            <span>Category filter</span>
            <select value={productCategoryFilter} onChange={(event) => setProductCategoryFilter(event.target.value)}>
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
            <span>Brand filter</span>
            <select value={productBrandFilter} onChange={(event) => setProductBrandFilter(event.target.value)}>
              <option value="all">All brands</option>
              <option value="">No brand</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Purpose filter</span>
            <select value={productPurposeFilter} onChange={(event) => setProductPurposeFilter(event.target.value)}>
              <option value="all">All purposes</option>
              <option value="sale">For sale</option>
              <option value="procedure">For procedures</option>
              <option value="both">Both</option>
            </select>
          </label>
        </div>
        <DataTable
          columns={["Category", "Brand", "Purpose", "Product", "Margin", "Stock", "Package", "Status", "Actions"]}
          rows={
            pagedProducts.length > 0
              ? pagedProducts.map((item) => {
                  const stockLevel = getProductStockLevel(item);

                  return [
                    item.category,
                    item.brand || "-",
                    formatProductPurpose(item.purpose),
                    <button className="table-link-button" onClick={() => setSelectedProductId(item.id)} type="button">
                      {item.name}
                    </button>,
                    formatProductMargin(item),
                    stockLevel === "low" || stockLevel === "out" ? <span className="danger-text">{formatProductStock(item)}</span> : formatProductStock(item),
                    item.contentAmount ? `${formatPlainNumber(item.contentAmount)} ${formatUnit(item.contentUnit)}` : "not set",
                    <StatusBadge status={stockLevel} />,
                    <InlineActions
                      labels={["Details", "Edit", "Delete"]}
                      onAction={(label) => {
                        if (label === "Details") {
                          setSelectedProductId(item.id);
                          return;
                        }

                        if (label === "Edit") {
                          setEditingProductId(item.id);
                          return;
                        }

                        void runAction(() => deleteAdminProduct(item.id));
                      }}
                    />
                  ];
                })
              : [["No products match the current filters.", "-", "-", "-", "-", "-", "-", "-", "-"]]
          }
        />
        <PaginationControls currentPage={currentProductPage} label={`${filteredProducts.length} products`} onPageChange={setProductPage} pageCount={productPageCount} />
      </Panel>
      <Panel title="Stock movement history" action="Add movement" onAction={() => setIsCreatingStockMovement(true)} wide>
        <div className="stock-history-summary">
          <div>
            <p className="admin-kicker">Inventory logistics</p>
            <strong>{stockMovementRows.length} movements</strong>
            <span>Track purchases, returns, adjustments and material balance changes.</span>
          </div>
          <button className="secondary-button compact-button" onClick={() => setIsViewingStockHistory(true)} type="button">
            View full history
          </button>
        </div>
        <DataTable
          columns={["Date", "Type", "Product", "Amount", "Reason"]}
          rows={
            latestStockMovementRows.length > 0
              ? latestStockMovementRows.map((movement) => [
                  formatStockMovementDateTime(movement.createdAt),
                  movement.type,
                  movement.product,
                  movement.amount,
                  movement.reason || "-"
                ])
              : [["No stock movements yet.", "-", "-", "-", "-"]]
          }
        />
      </Panel>
      {isCreatingBrand ? (
        <AdminModal title="New product brand" onClose={() => setIsCreatingBrand(false)}>
          <ProductBrandForm
            onCancel={() => setIsCreatingBrand(false)}
            onSubmit={(payload) =>
              runAction(async () => {
                await createAdminProductBrand(payload);
                setIsCreatingBrand(false);
              })
            }
          />
        </AdminModal>
      ) : null}
      {editingBrand ? (
        <AdminModal title={`Edit brand: ${editingBrand.name}`} onClose={() => setEditingBrandId(null)}>
          <ProductBrandForm
            brand={editingBrand}
            key={editingBrand.id}
            onCancel={() => setEditingBrandId(null)}
            onSubmit={(payload) =>
              runAction(async () => {
                await updateAdminProductBrand(editingBrand.id, payload);
                setEditingBrandId(null);
              })
            }
          />
        </AdminModal>
      ) : null}
      {isCreatingCategory ? (
        <AdminModal title="New product category" onClose={() => setIsCreatingCategory(false)}>
          <ProductCategoryForm
            onCancel={() => setIsCreatingCategory(false)}
            onSubmit={(payload) =>
              runAction(async () => {
                await createAdminProductCategory(payload);
                setIsCreatingCategory(false);
              })
            }
          />
        </AdminModal>
      ) : null}
      {editingCategory ? (
        <AdminModal title={`Edit category: ${editingCategory.name}`} onClose={() => setEditingCategoryId(null)}>
          <ProductCategoryForm
            category={editingCategory}
            key={editingCategory.id}
            onCancel={() => setEditingCategoryId(null)}
            onSubmit={(payload) =>
              runAction(async () => {
                await updateAdminProductCategory(editingCategory.id, payload);
                setEditingCategoryId(null);
              })
            }
          />
        </AdminModal>
      ) : null}
      {isCreatingProduct ? (
        <AdminModal title="New product" onClose={() => setIsCreatingProduct(false)}>
          <ProductForm
            brands={brands}
            categories={categories}
            onCancel={() => setIsCreatingProduct(false)}
            onSubmit={(payload) =>
              runAction(async () => {
                await createAdminProduct(payload);
                setIsCreatingProduct(false);
              })
            }
          />
        </AdminModal>
      ) : null}
      {editingProduct ? (
        <AdminModal title={`Edit product: ${editingProduct.name}`} onClose={() => setEditingProductId(null)}>
          <ProductForm
            brands={brands}
            categories={categories}
            key={editingProduct.id}
            onCancel={() => setEditingProductId(null)}
            onSubmit={(payload) =>
              runAction(async () => {
                await updateAdminProduct(editingProduct.id, payload);
                setEditingProductId(null);
              })
            }
            product={editingProduct}
          />
        </AdminModal>
      ) : null}
      {isCreatingStockMovement ? (
        <AdminModal title="Stock movement" onClose={() => setIsCreatingStockMovement(false)}>
          <StockMovementForm
            onCancel={() => setIsCreatingStockMovement(false)}
            products={products}
            onSubmit={(payload) =>
              runAction(async () => {
                await createAdminStockMovement(payload);
                setIsCreatingStockMovement(false);
              })
            }
          />
        </AdminModal>
      ) : null}
      {isViewingStockHistory ? <StockMovementHistoryModal movements={stockMovementRows} onClose={() => setIsViewingStockHistory(false)} /> : null}
      {selectedProduct ? (
        <ProductInventoryModal
          onClose={() => setSelectedProductId(null)}
          onDelete={() =>
            runAction(async () => {
              await deleteAdminProduct(selectedProduct.id);
              setSelectedProductId(null);
            })
          }
          onEdit={() => {
            setEditingProductId(selectedProduct.id);
            setSelectedProductId(null);
          }}
          product={selectedProduct}
          runAction={runAction}
        />
      ) : null}
    </div>
  );
}

function ProductBrandForm({
  brand,
  onCancel,
  onSubmit
}: {
  brand?: AdminData["productBrands"][number];
  onCancel: () => void;
  onSubmit: (payload: ProductBrandInput) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: brand?.name ?? "",
    description: brand?.description ?? ""
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void onSubmit({
      name: form.name,
      description: form.description || undefined
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        <span>Brand name</span>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </label>
      <label>
        <span>Description</span>
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
      </label>
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="primary-button admin-submit" type="submit">
          {brand ? "Save brand" : "Create brand"}
        </button>
      </div>
    </form>
  );
}

function ProductCategoryForm({
  category,
  onCancel,
  onSubmit
}: {
  category?: AdminData["productCategories"][number];
  onCancel: () => void;
  onSubmit: (payload: ProductCategoryInput) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: category?.name ?? "",
    description: category?.description ?? "",
    imageUrl: category?.imageUrl ?? ""
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function uploadFile(file: File | null) {
    if (!file) {
      return;
    }

    setIsUploading(true);
    setUploadError("");

    try {
      const result = await uploadAdminProductImage(file);
      setForm((current) => ({ ...current, imageUrl: result.imageUrl }));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not upload image.");
    } finally {
      setIsUploading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void onSubmit({
      name: form.name,
      description: form.description || undefined,
      imageUrl: form.imageUrl
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        <span>Category name</span>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </label>
      <label>
        <span>Description</span>
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
      </label>
      <label>
        <span>Category photo</span>
        <input accept="image/jpeg,image/png,image/webp,image/gif" disabled={isUploading} onChange={(event) => void uploadFile(event.target.files?.[0] ?? null)} type="file" />
      </label>
      {uploadError ? <p className="form-note">{uploadError}</p> : null}
      {form.imageUrl ? (
        <div className="portfolio-form-preview">
          <img alt="Product category preview" src={form.imageUrl} />
        </div>
      ) : null}
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="primary-button admin-submit" disabled={isUploading || !form.imageUrl} type="submit">
          {isUploading ? "Uploading..." : category ? "Save category" : "Create category"}
        </button>
      </div>
    </form>
  );
}

function ProductForm({
  brands,
  categories,
  onCancel,
  onSubmit,
  product
}: {
  brands: AdminData["productBrands"];
  categories: AdminData["productCategories"];
  onCancel?: () => void;
  onSubmit: (payload: ProductInput) => Promise<void>;
  product?: AdminData["products"][number];
}) {
  const [form, setForm] = useState({
    categoryId: product?.categoryId ?? categories[0]?.id ?? "",
    brandId: product?.brandId ?? brands[0]?.id ?? "",
    category: product?.category ?? "",
    name: product?.name ?? "",
    description: product?.description ?? "",
    quote: product?.quote ?? "",
    brand: product?.brand ?? "",
    sku: product?.sku ?? "",
    imageUrl: product?.imageUrl ?? "",
    purpose: product?.purpose ?? ("both" as ProductPurpose),
    purchase: String(product?.purchase ?? 0),
    sale: String(product?.sale ?? 0),
    stock: String(product?.stock ?? 0),
    min: String(product?.min ?? 0),
    contentAmount: product?.contentAmount ? String(product.contentAmount) : "",
    contentUnit: product?.contentUnit ?? ("ml" as MeasurementUnit)
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function uploadFile(file: File | null) {
    if (!file) {
      return;
    }

    setIsUploading(true);
    setUploadError("");

    try {
      const result = await uploadAdminProductImage(file);
      setForm((current) => ({ ...current, imageUrl: result.imageUrl }));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not upload image.");
    } finally {
      setIsUploading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      categoryId: categories.length > 0 ? form.categoryId : undefined,
      category: categories.length > 0 ? undefined : form.category,
      brandId: brands.length > 0 ? form.brandId : undefined,
      name: form.name,
      description: form.description,
      quote: form.quote,
      brand: brands.length > 0 ? undefined : form.brand || undefined,
      sku: form.sku || undefined,
      imageUrl: form.imageUrl,
      purpose: form.purpose,
      purchase: Number(form.purchase),
      sale: Number(form.sale),
      stock: Number(form.stock),
      min: Number(form.min),
      contentAmount: form.contentAmount ? Number(form.contentAmount) : undefined,
      contentUnit: form.contentAmount ? form.contentUnit : undefined
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      {categories.length > 0 ? (
        <label>
          <span>Category</span>
          <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} required>
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label>
          <span>Category</span>
          <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required />
        </label>
      )}
      <label>
        <span>Product</span>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </label>
      <label>
        <span>Description</span>
        <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="For all hair types" />
      </label>
      {brands.length > 0 ? (
        <label>
          <span>Brand</span>
          <select value={form.brandId} onChange={(event) => setForm({ ...form, brandId: event.target.value })} required>
            <option value="">Select brand</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label>
          <span>Brand</span>
          <input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
        </label>
      )}
      <label>
        <span>Product quote</span>
        <textarea value={form.quote} onChange={(event) => setForm({ ...form, quote: event.target.value })} placeholder="A short elegant line for the client product card" rows={3} />
      </label>
      <label>
        <span>SKU</span>
        <input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} />
      </label>
      <label>
        <span>Purpose</span>
        <select value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value as ProductPurpose })}>
          <option value="sale">For sale</option>
          <option value="procedure">For procedures</option>
          <option value="both">Both</option>
        </select>
      </label>
      <label>
        <span>Product photo</span>
        <input accept="image/jpeg,image/png,image/webp,image/gif" disabled={isUploading} onChange={(event) => void uploadFile(event.target.files?.[0] ?? null)} type="file" />
      </label>
      {uploadError ? <p className="form-note">{uploadError}</p> : null}
      {form.imageUrl ? (
        <div className="portfolio-form-preview">
          <img alt="Product preview" src={form.imageUrl} />
        </div>
      ) : null}
      <label>
        <span>Purchase price</span>
        <input type="number" min="0" value={form.purchase} onChange={(event) => setForm({ ...form, purchase: event.target.value })} />
      </label>
      <label>
        <span>Sale price</span>
        <input type="number" min="0" value={form.sale} onChange={(event) => setForm({ ...form, sale: event.target.value })} required />
      </label>
      <label>
        <span>Stock</span>
        <input type="number" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} required />
      </label>
      <label>
        <span>Minimum stock</span>
        <input type="number" min="0" value={form.min} onChange={(event) => setForm({ ...form, min: event.target.value })} required />
      </label>
      <label>
        <span>Package content</span>
        <input type="number" min="0.01" step="0.01" value={form.contentAmount} onChange={(event) => setForm({ ...form, contentAmount: event.target.value })} placeholder="60" />
      </label>
      <label>
        <span>Content unit</span>
        <select value={form.contentUnit} onChange={(event) => setForm({ ...form, contentUnit: event.target.value as MeasurementUnit })}>
          <option value="ml">ml</option>
          <option value="gram">g</option>
        </select>
      </label>
      <div className="form-actions">
        {onCancel ? (
          <button className="secondary-button compact-button" onClick={onCancel} type="button">
            Cancel
          </button>
        ) : null}
        <button
          className="primary-button admin-submit"
          disabled={isUploading || !form.imageUrl || (categories.length > 0 ? !form.categoryId : !form.category.trim()) || (brands.length > 0 ? !form.brandId : false)}
          type="submit"
        >
          {isUploading ? "Uploading..." : product ? "Save product" : "Add product"}
        </button>
      </div>
    </form>
  );
}

function StockMovementForm({
  onCancel,
  onSubmit,
  products
}: {
  onCancel: () => void;
  onSubmit: (payload: StockMovementInput) => Promise<void>;
  products: AdminData["products"];
}) {
  const initialProduct = products[0];
  const [form, setForm] = useState({
    categoryId: initialProduct?.categoryId ?? "",
    productId: initialProduct?.id ?? "",
    movementType: "purchase" as StockMovementInput["movementType"],
    amountMode: "packages" as StockMovementInput["amountMode"],
    amount: "1",
    reason: ""
  });
  const productCategories = useMemo(() => {
    const categoryMap = new Map<string, string>();

    products.forEach((product) => {
      const categoryId = product.categoryId ?? "";
      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, product.category || "Uncategorized");
      }
    });

    return Array.from(categoryMap, ([id, name]) => ({ id, name })).sort((left, right) => {
      if (left.id === "") {
        return 1;
      }

      if (right.id === "") {
        return -1;
      }

      return left.name.localeCompare(right.name);
    });
  }, [products]);
  const categoryProducts = products.filter((product) => (product.categoryId ?? "") === form.categoryId);
  const selectedProduct = categoryProducts.find((product) => product.id === form.productId) ?? categoryProducts[0];
  const canUseContent = Boolean(selectedProduct?.contentAmount && selectedProduct.contentUnit);

  useEffect(() => {
    const categoryExists = productCategories.some((category) => category.id === form.categoryId);
    const nextCategoryId = categoryExists ? form.categoryId : productCategories[0]?.id ?? "";
    const nextCategoryProducts = products.filter((product) => (product.categoryId ?? "") === nextCategoryId);
    const productExists = nextCategoryProducts.some((product) => product.id === form.productId);

    if (nextCategoryId !== form.categoryId || !productExists) {
      setForm((current) => ({
        ...current,
        categoryId: nextCategoryId,
        productId: nextCategoryProducts[0]?.id ?? ""
      }));
    }
  }, [form.categoryId, form.productId, productCategories, products]);

  useEffect(() => {
    if (form.amountMode === "content" && !canUseContent) {
      setForm((current) => ({ ...current, amountMode: "packages" }));
    }
  }, [canUseContent, form.amountMode]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProduct) {
      return;
    }

    void onSubmit({
      productId: form.productId,
      movementType: form.movementType,
      amountMode: form.amountMode,
      amount: Number(form.amount),
      reason: form.reason || undefined
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        <span>Category</span>
        <select
          value={form.categoryId}
          onChange={(event) => {
            const categoryId = event.target.value;
            const firstProduct = products.find((product) => (product.categoryId ?? "") === categoryId);
            setForm({ ...form, categoryId, productId: firstProduct?.id ?? "" });
          }}
        >
          {productCategories.map((category) => (
            <option key={category.id || "uncategorized"} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Product</span>
        <select value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })} required>
          {categoryProducts.map((product) => (
            <option key={product.id} value={product.id}>
              {formatProductOption(product)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Movement type</span>
        <select value={form.movementType} onChange={(event) => setForm({ ...form, movementType: event.target.value as StockMovementInput["movementType"] })}>
          <option value="purchase">Purchase</option>
          <option value="adjustment">Adjustment</option>
          <option value="return">Return</option>
        </select>
      </label>
      <label>
        <span>Amount mode</span>
        <select value={form.amountMode} onChange={(event) => setForm({ ...form, amountMode: event.target.value as StockMovementInput["amountMode"] })}>
          <option value="packages">Packages</option>
          <option value="content" disabled={!canUseContent}>
            {selectedProduct?.contentUnit ? formatUnit(selectedProduct.contentUnit) : "ml/g"}
          </option>
        </select>
      </label>
      <label>
        <span>{form.amountMode === "content" ? `Amount, ${formatUnit(selectedProduct?.contentUnit)}` : "Packages"}</span>
        <input step={form.amountMode === "content" ? "0.01" : "1"} type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required />
      </label>
      <label>
        <span>Reason</span>
        <textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} rows={3} />
      </label>
      {form.movementType === "adjustment" ? <small className="form-note">Adjustment can be positive or negative.</small> : null}
      {!canUseContent ? <small className="form-note">Configure package content on the product to use ml/g movements.</small> : null}
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="primary-button admin-submit" disabled={!selectedProduct} type="submit">
          Save movement
        </button>
      </div>
    </form>
  );
}

function StockMovementHistoryModal({ movements, onClose }: { movements: StockMovementHistoryRow[]; onClose: () => void }) {
  const [period, setPeriod] = useState<"week" | "month" | "date">("week");
  const [selectedDate, setSelectedDate] = useState(today);
  const [page, setPage] = useState(1);
  const filteredMovements = movements.filter((movement) => {
    const movementDate = new Date(movement.createdAt);

    if (period === "date") {
      return toDateTimeFields(movement.createdAt).date === selectedDate;
    }

    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (period === "week" ? 7 : 30));

    return movementDate >= cutoff;
  });
  const pageCount = Math.max(1, Math.ceil(filteredMovements.length / STOCK_MOVEMENT_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedMovements = filteredMovements.slice((currentPage - 1) * STOCK_MOVEMENT_PAGE_SIZE, currentPage * STOCK_MOVEMENT_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [period, selectedDate]);

  return (
    <AdminModal className="stock-history-modal" title="Stock movement history" onClose={onClose}>
      <div className="table-toolbar">
        <label>
          <span>Period</span>
          <select value={period} onChange={(event) => setPeriod(event.target.value as "week" | "month" | "date")}>
            <option value="week">Last week</option>
            <option value="month">Last month</option>
            <option value="date">Specific date</option>
          </select>
        </label>
        {period === "date" ? (
          <label>
            <span>Date</span>
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          </label>
        ) : null}
      </div>
      <DataTable
        columns={["Date", "Time", "Type", "Category", "Brand", "Product", "Amount", "Reason"]}
        rows={
          pagedMovements.length > 0
            ? pagedMovements.map((movement) => [
                formatStockMovementDate(movement.createdAt),
                formatStockMovementTime(movement.createdAt),
                movement.type,
                movement.category,
                movement.brand || "-",
                movement.product,
                movement.amount,
                movement.reason || "-"
              ])
            : [["No stock movements for this period.", "-", "-", "-", "-", "-", "-", "-"]]
        }
      />
      <PaginationControls currentPage={currentPage} label={`${filteredMovements.length} movements`} onPageChange={setPage} pageCount={pageCount} />
    </AdminModal>
  );
}

function ProductInventoryModal({
  onClose,
  onDelete,
  onEdit,
  product,
  runAction
}: {
  onClose: () => void;
  onDelete: () => Promise<void>;
  onEdit: () => void;
  product: AdminData["products"][number];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const productMovements = buildStockMovementHistoryRows([product]);
  const latestMovements = productMovements.slice(0, 6);
  const stockLevel = getProductStockLevel(product);

  return (
    <AdminModal className="product-inventory-modal" title="Product card" onClose={onClose}>
      <div className="product-inventory-detail">
        <section className="product-inventory-hero">
          <div className="product-inventory-image">
            {product.imageUrl ? <img alt={product.name} src={product.imageUrl} /> : <Package aria-hidden="true" size={30} />}
          </div>
          <div className="product-inventory-title">
            <p className="admin-kicker">{product.brand || "No brand"}</p>
            <h3>{product.name}</h3>
            <span>{product.description || "No product description."}</span>
          </div>
          <StatusBadge status={stockLevel} />
        </section>

        <div className="product-inventory-layout">
          <section className="product-inventory-panel">
            <div className="product-stat-grid">
              <div>
                <span>Category</span>
                <strong>{product.category}</strong>
              </div>
              <div>
                <span>Purpose</span>
                <strong>{formatProductPurpose(product.purpose)}</strong>
              </div>
              <div>
                <span>SKU</span>
                <strong>{product.sku || "-"}</strong>
              </div>
              <div>
                <span>Package</span>
                <strong>{product.contentAmount ? `${formatPlainNumber(product.contentAmount)} ${formatUnit(product.contentUnit)}` : "not set"}</strong>
              </div>
              <div>
                <span>Purchase</span>
                <strong>{adminMoney.format(product.purchase)}</strong>
              </div>
              <div>
                <span>Sale</span>
                <strong>{adminMoney.format(product.sale)}</strong>
              </div>
              <div>
                <span>Margin</span>
                <strong>{formatProductMargin(product)}</strong>
              </div>
              <div>
                <span>Stock</span>
                <strong>{formatProductStock(product)}</strong>
              </div>
            </div>
            {product.quote ? <blockquote>{product.quote}</blockquote> : null}
            <div className="product-card-actions">
              <button className="secondary-button compact-button" onClick={onEdit} type="button">
                Edit product
              </button>
              <button
                className="secondary-button compact-button danger-action"
                onClick={() => {
                  if (window.confirm("Remove this product? If it is used in history, it will be deactivated instead.")) {
                    void onDelete();
                  }
                }}
                type="button"
              >
                Remove / deactivate
              </button>
            </div>
          </section>

          <section className="product-inventory-panel">
            <p className="admin-kicker">Quick stock action</p>
            <QuickProductMovementForm product={product} runAction={runAction} />
          </section>
        </div>

        <section className="product-inventory-panel">
          <div className="product-history-header">
            <div>
              <p className="admin-kicker">Local movement history</p>
              <strong>{productMovements.length} movements</strong>
            </div>
            <small>Latest changes for this product only.</small>
          </div>
          <DataTable
            columns={["Date", "Type", "Amount", "Reason"]}
            rows={
              latestMovements.length > 0
                ? latestMovements.map((movement) => [formatStockMovementDateTime(movement.createdAt), movement.type, movement.amount, movement.reason || "-"])
                : [["No movements for this product yet.", "-", "-", "-"]]
            }
          />
        </section>
      </div>
    </AdminModal>
  );
}

function QuickProductMovementForm({
  product,
  runAction
}: {
  product: AdminData["products"][number];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [action, setAction] = useState<"restock" | "write_off" | "correct">("restock");
  const [amountMode, setAmountMode] = useState<StockMovementInput["amountMode"]>(product.contentAmount ? "content" : "packages");
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState("");
  const canUseContent = Boolean(product.contentAmount && product.contentUnit);

  useEffect(() => {
    setAmountMode(product.contentAmount ? "content" : "packages");
    setAmount("1");
    setReason("");
  }, [product.id, product.contentAmount]);

  useEffect(() => {
    if (amountMode === "content" && !canUseContent) {
      setAmountMode("packages");
    }
  }, [amountMode, canUseContent]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const rawAmount = Math.abs(Number(amount));
    const signedAmount = action === "write_off" ? -rawAmount : action === "correct" ? Number(amount) : rawAmount;

    void runAction(async () => {
      await createAdminStockMovement({
        productId: product.id,
        movementType: action === "restock" ? "purchase" : "adjustment",
        amountMode,
        amount: signedAmount,
        reason: reason || defaultStockReason(action)
      });
      setAmount("1");
      setReason("");
    });
  }

  return (
    <form className="quick-stock-form" onSubmit={submit}>
      <div className="segmented-control" role="group" aria-label="Stock action">
        <button className={action === "restock" ? "active" : ""} onClick={() => setAction("restock")} type="button">
          Restock
        </button>
        <button className={action === "write_off" ? "active" : ""} onClick={() => setAction("write_off")} type="button">
          Write off
        </button>
        <button className={action === "correct" ? "active" : ""} onClick={() => setAction("correct")} type="button">
          Correct
        </button>
      </div>
      <div className="quick-stock-grid">
        <label>
          <span>Amount mode</span>
          <select value={amountMode} onChange={(event) => setAmountMode(event.target.value as StockMovementInput["amountMode"])}>
            <option value="packages">Packages</option>
            <option value="content" disabled={!canUseContent}>
              {product.contentUnit ? formatUnit(product.contentUnit) : "ml/g"}
            </option>
          </select>
        </label>
        <label>
          <span>{amountMode === "content" ? `Amount, ${formatUnit(product.contentUnit)}` : "Packages"}</span>
          <input
            step={amountMode === "content" ? "0.01" : "1"}
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>
      </div>
      <label>
        <span>Reason</span>
        <textarea placeholder={defaultStockReason(action)} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      {action === "correct" ? <small className="form-note">Use a positive number to add stock or a negative number to reduce it.</small> : null}
      {!canUseContent ? <small className="form-note">Package content is not configured, so only package movements are available.</small> : null}
      <button className="primary-button admin-submit" disabled={!Number(amount)} type="submit">
        Save stock action
      </button>
    </form>
  );
}

function buildStockMovementHistoryRows(products: AdminData["products"]): StockMovementHistoryRow[] {
  return products
    .flatMap((product) =>
      product.movements.map((movement, index) => ({
        id: `${product.id}-${movement.createdAt}-${movement.type}-${index}`,
        amount: formatStockMovementAmount(movement),
        brand: product.brand,
        category: product.category,
        createdAt: movement.createdAt,
        product: product.name,
        reason: movement.reason,
        type: movement.type
      }))
    )
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function buildInventorySummary(products: AdminData["products"]) {
  return products.reduce(
    (summary, product) => {
      const stockLevel = getProductStockLevel(product);
      const packageEquivalent = product.stockPackageEquivalent ?? product.stock;

      summary.totalProducts += 1;
      summary.retailValue += product.sale * packageEquivalent;

      if (product.stockStatus !== "not_tracked") {
        summary.trackedProducts += 1;
      }

      if (stockLevel === "low") {
        summary.lowStockProducts += 1;
      }

      if (stockLevel === "out") {
        summary.outOfStockProducts += 1;
      }

      if (product.purpose === "procedure" || product.purpose === "both") {
        summary.procedureProducts += 1;
      }

      return summary;
    },
    {
      lowStockProducts: 0,
      outOfStockProducts: 0,
      procedureProducts: 0,
      retailValue: 0,
      totalProducts: 0,
      trackedProducts: 0
    }
  );
}

function formatProductPurpose(purpose: ProductPurpose | undefined) {
  if (purpose === "sale") {
    return "For sale";
  }

  if (purpose === "procedure") {
    return "For procedures";
  }

  return "Both";
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

function getProductStockLevel(product: AdminData["products"][number]) {
  if (product.stockStatus === "not_tracked") {
    return "not_tracked";
  }

  if (product.stockContentAmount !== null) {
    return product.stockContentAmount <= 0 ? "out" : product.stockStatus;
  }

  return product.stock <= 0 ? "out" : product.stockStatus;
}

function formatProductMargin(product: AdminData["products"][number]) {
  return adminMoney.format(product.sale - product.purchase);
}

function defaultStockReason(action: "restock" | "write_off" | "correct") {
  if (action === "write_off") {
    return "Manual write-off";
  }

  if (action === "correct") {
    return "Stock correction";
  }

  return "Stock replenishment";
}

function formatStockMovementAmount(movement: AdminData["products"][number]["movements"][number]) {
  if (movement.contentQuantity !== null && movement.contentUnit) {
    const sign = movement.contentQuantity > 0 ? "+" : "";
    return `${sign}${formatPlainNumber(movement.contentQuantity)} ${formatUnit(movement.contentUnit)}`;
  }

  const sign = movement.quantity > 0 ? "+" : "";
  return `${sign}${movement.quantity} packs`;
}

function formatStockMovementDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatStockMovementTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatStockMovementDateTime(value: string) {
  return `${formatStockMovementDate(value)}, ${formatStockMovementTime(value)}`;
}

function toDateTimeFields(value: string) {
  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

  return {
    date: localDate,
    time: date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  };
}
