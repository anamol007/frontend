export const routes = {
  stock: {
    base: '/stock/',                                 // GET aggregated stock (with attached transfers), POST to create (incl. transfers)
    byProduct: (id) => `/stock/product/${id}`,      // GET stock for a product
    byInventory: (id) => `/stock/inventory/${id}`,  // GET stock for an inventory
    low: (threshold = 10) => `/stock/low?threshold=${threshold}`,
    quantity: (id) => `/stock/${id}/quantity`,      // PATCH { operation:'ADD'|'SUBTRACT', quantityChange }
    summaryByProduct: (id) => `/stock/summary/product/${id}`,
    summaryByInventory: (id) => `/stock/summary/inventory/${id}`,
  },
};