const transformData = (data) => {
    const groupedData = data.reduce((acc, product) => {
        // Find if the category already exists in the accumulator
        let category = acc.find(cat => cat.category_id === product.category_id);
      
        if (!category) {
          // Create a new category object if not found
          category = {
            category_id: product.category_id,
            category_name: product.title, // Assuming `title` is the category name
            products: []
          };
          acc.push(category);
        }
      
        // Add the product to the products array of the corresponding category
        category.products.push({
          product_id: product.product_id,
          product_name: product.product_name,
          price: product.price,
          sub_title: product.sub_title,
          image_link: product.image_link,
        });
      
        return acc;
    }, []);
    return groupedData;
}

module.exports = {
    transformData
}