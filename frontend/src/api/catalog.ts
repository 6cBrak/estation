import api from '@/lib/axios'

export interface LubricantBrand { id: string; name: string }
export interface LubricantProduct {
  id: string; brand: string; brand_name?: string; code: string; name: string
  grade: string; packaging: string
  sale_price_boutique_xof: string; sale_price_piste_xof: string; is_active: boolean
}
export interface ServiceCatalogItem {
  id: string; station: string; code: string; name: string
  default_price_xof: string; is_active: boolean
}
export interface GasBottleFormat {
  id: string; weight_kg: string; label: string
  sale_price_xof: string; deposit_xof: string; is_active: boolean
}
export interface LubricantStockEntry {
  id: string
  product: string
  product_name: string
  brand_name: string
  grade: string
  sale_price_boutique_xof: string
  sale_price_piste_xof: string
  station: string
  station_name: string
  quantity: string
}

export interface GasStockEntry {
  id: string
  format: string
  format_label: string
  weight_kg: string
  sale_price_xof: string
  station: string
  station_name: string
  quantity: string
}

export interface ProductCategory { id: string; name: string }
export interface Product {
  id: string; category: string; category_name?: string; code: string
  barcode: string; name: string; purchase_price_xof: string
  sale_price_xof: string; vat_rate: string; is_active: boolean
}

export const catalogApi = {
  // Lubrifiants
  listLubBrands: () => api.get<LubricantBrand[]>('/lubricants/brands/'),
  createLubBrand: (data: { name: string }) =>
    api.post<LubricantBrand>('/lubricants/brands/', data),
  listLubProducts: (params?: Record<string, string>) =>
    api.get<LubricantProduct[]>('/lubricants/products/', { params }),
  createLubProduct: (data: Omit<LubricantProduct, 'id' | 'is_active' | 'brand_name'>) =>
    api.post<LubricantProduct>('/lubricants/products/', data),
  updateLubProduct: (id: string, data: Partial<LubricantProduct>) =>
    api.patch<LubricantProduct>(`/lubricants/products/${id}/`, data),

  // Services
  listServices: (params?: Record<string, string>) =>
    api.get<ServiceCatalogItem[]>('/services/', { params }),
  createService: (data: Omit<ServiceCatalogItem, 'id' | 'is_active'>) =>
    api.post<ServiceCatalogItem>('/services/', data),
  updateService: (id: string, data: Partial<ServiceCatalogItem>) =>
    api.patch<ServiceCatalogItem>(`/services/${id}/`, data),

  // Gaz
  listGasFormats: () => api.get<GasBottleFormat[]>('/gas/formats/'),
  createGasFormat: (data: Omit<GasBottleFormat, 'id' | 'is_active'>) =>
    api.post<GasBottleFormat>('/gas/formats/', data),
  updateGasFormat: (id: string, data: Partial<GasBottleFormat>) =>
    api.patch<GasBottleFormat>(`/gas/formats/${id}/`, data),

  // Stocks lubrifiants
  listLubStocks: (params?: Record<string, string>) =>
    api.get<{ results: LubricantStockEntry[]; count: number }>('/lubricants/stocks/', { params }),
  createLubStock: (data: { product: string; station: string; quantity: string }) =>
    api.post<LubricantStockEntry>('/lubricants/stocks/', data),
  updateLubStock: (id: string, data: { quantity: string }) =>
    api.patch<LubricantStockEntry>(`/lubricants/stocks/${id}/`, data),

  // Stocks gaz
  listGasStocks: (params?: Record<string, string>) =>
    api.get<{ results: GasStockEntry[]; count: number }>('/gas/stocks/', { params }),
  createGasStock: (data: { format: string; station: string; quantity: number }) =>
    api.post<GasStockEntry>('/gas/stocks/', data),
  updateGasStock: (id: string, data: { quantity: number }) =>
    api.patch<GasStockEntry>(`/gas/stocks/${id}/`, data),

  // Boutique
  listProductCategories: () => api.get<ProductCategory[]>('/shop/categories/'),
  createProductCategory: (data: { name: string }) =>
    api.post<ProductCategory>('/shop/categories/', data),
  listProducts: (params?: Record<string, string>) =>
    api.get<Product[]>('/shop/products/', { params }),
  createProduct: (data: Omit<Product, 'id' | 'is_active' | 'category_name'>) =>
    api.post<Product>('/shop/products/', data),
  updateProduct: (id: string, data: Partial<Product>) =>
    api.patch<Product>(`/shop/products/${id}/`, data),
}
