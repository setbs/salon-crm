import { listActiveEmployees, listActiveServices, listPublicProducts, listVisiblePortfolio } from "./catalog.repository.js";

export async function getServices() {
  const services = await listActiveServices();

  return services.map((service) => ({
    id: service.id.toString(),
    categoryId: service.categoryId?.toString() ?? null,
    category: service.categoryId
      ? {
          id: service.categoryId.toString(),
          name: service.categoryName ?? "Other services",
          description: service.categoryDescription
        }
      : null,
    name: service.name,
    description: service.description,
    durationMinutes: service.durationMinutes,
    price: Number(service.price),
    priceFrom: service.priceFrom ? Number(service.priceFrom) : null,
    priceTo: service.priceTo ? Number(service.priceTo) : null
  }));
}

export async function getEmployees(serviceIds: bigint[]) {
  const employees = await listActiveEmployees(serviceIds);

  return employees.map((employee) => ({
    id: employee.id.toString(),
    firstName: employee.user.firstName,
    lastName: employee.user.lastName,
    specialization: employee.specialization,
    description: employee.description,
    services: employee.services.map(({ service }) => ({
      id: service.id.toString(),
      name: service.name,
      categoryId: null,
      category: null
    }))
  }));
}

export async function getPortfolio() {
  const photos = await listVisiblePortfolio();

  return photos.map((photo) => ({
    id: photo.id.toString(),
    title: photo.description ?? "Salon work",
    description: photo.description,
    imageUrl: photo.imageUrl,
    employee: `${photo.employee.user.firstName} ${photo.employee.user.lastName}`
  }));
}

export async function getProducts() {
  const products = await listPublicProducts();

  return products.map((product) => ({
    id: product.id.toString(),
    category: product.categoryId
      ? {
          id: product.categoryId.toString(),
          name: product.categoryName ?? "Home care",
          description: product.categoryDescription,
          imageUrl: product.categoryImageUrl
        }
      : null,
    name: product.name,
    brand: product.brandName ?? product.brand,
    description: product.description,
    quote: product.quote,
    imageUrl: product.imageUrl,
    price: Number(product.price),
    contentAmount: product.contentAmount ? Number(product.contentAmount) : null,
    contentUnit: product.contentUnit,
    inStock: product.stockQuantity > 0 || (product.stockContentAmount !== null && Number(product.stockContentAmount) > 0)
  }));
}
