// Seeded Cotabato City court directory. Location pins are geocoded at runtime from these addresses.
// Availability is intentionally separate from the directory data and comes from community reports.
export const COTABATO_CENTER = [7.22361, 124.24644];
export const CITY_BOUNDS = { minLat: 7.14, maxLat: 7.29, minLng: 124.17, maxLng: 124.31 };

export const COURTS = [
  { id:"uptown", name:"Uptown Pickleball Cotabato", area:"Tamontaka", barangay:"Tamontaka", address:"56MH+8GR, Tamontaka Bubong Rd, Cotabato City, Maguindanao del Norte", type:"indoor", courts:4, rate:"₱350/hr", contact:"", tags:["all levels","reservable"], source:"public_listing" },
  { id:"courtyard", name:"The Courtyard Pickleball", area:"Bagua II", barangay:"Bagua", address:"Mangungan Street, Cotabato City, Maguindanao del Norte", type:"indoor", courts:3, rate:"₱350/hr", contact:"09193704328", tags:["covered","all levels"], source:"public_listing" },
  { id:"3s", name:"3S Pickleball Court", area:"Tamontaka 2", barangay:"Tamontaka", address:"Tamontaka 2, Cotabato City, Maguindanao del Norte", type:"covered", courts:4, rate:"₱350/hr", contact:"09359356943", tags:["all levels"], source:"public_listing" },
  { id:"roadside", name:"Roadside Pickleball", area:"Roales St", barangay:"Poblacion", address:"667P+M4W, Roales St, Cotabato City, Maguindanao del Norte", type:"outdoor", courts:1, rate:"Free / verify", contact:"09177297969", tags:["hard court","nets available"], source:"public_listing" },
  { id:"serozero", name:"Sero Zero2 Pickleball huH", area:"Rosary Heights V", barangay:"Rosary Heights", address:"5th St, Sero Compound, Rosary Heights V, Cotabato City, 9600", type:"indoor", courts:null, rate:"Verify", contact:"", tags:["sports club"], source:"maps_listing" },
  { id:"epicenter", name:"Epicenter Pickleball Cotabato", area:"Tamontaka 1", barangay:"Tamontaka", address:"Tamontaka 1, Cotabato City, Maguindanao del Norte", type:"outdoor", courts:null, rate:"Verify", contact:"09293373155", tags:["sports complex"], source:"maps_listing" },
  { id:"court-of-lao", name:"Court of Lao - Pickleball", area:"Gonzalo Javier", barangay:"Cotabato City", address:"Gonzalo Javier, Cotabato City, Maguindanao del Norte", type:"outdoor", courts:null, rate:"Verify", contact:"", tags:["sports club"], source:"maps_listing" },
  { id:"riverside", name:"Riverside Pickleball Court", area:"Tamontaka Bubong Rd", barangay:"Tamontaka", address:"55WP+2CC, Tamontaka Bubong Rd, Cotabato City, Maguindanao del Norte", type:"outdoor", courts:null, rate:"Verify", contact:"", tags:["outdoor"], source:"public_listing" },
  { id:"5th-street", name:"5th Street Pickleball Court", area:"5th Street", barangay:"Rosary Heights", address:"5th Street, Don E. Sero St, Cotabato City, Maguindanao del Norte", type:"outdoor", courts:null, rate:"Verify", contact:"", tags:["sports club"], source:"maps_listing" }
];
