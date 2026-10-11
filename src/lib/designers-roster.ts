// Test roster (owner decision 11 Oct 2026): the studio's 14 designers (case brief), fictional names,
// all emailing the owner so every booking can be checked from one inbox. Replace via DESIGNERS.
export const ROSTER: { name: string; role: string; slug: string }[] = [
  { name: "Ananya Kulkarni", role: "Principal designer · Residential", slug: "ananya-kulkarni" },
  { name: "Rohan Deshmukh", role: "Senior designer · Full homes", slug: "rohan-deshmukh" },
  { name: "Meher Joshi", role: "Designer · Kitchens & wardrobes", slug: "meher-joshi" },
  { name: "Kabir Shah", role: "Designer · Offices & clinics", slug: "kabir-shah" },
  { name: "Ishita Patwardhan", role: "Senior designer · Villas", slug: "ishita-patwardhan" },
  { name: "Aditya Bhosale", role: "Designer · Full homes", slug: "aditya-bhosale" },
  { name: "Sneha Gokhale", role: "Designer · Partial homes", slug: "sneha-gokhale" },
  { name: "Varun Mehta", role: "Senior designer · Commercial", slug: "varun-mehta" },
  { name: "Pooja Iyer", role: "Designer · Lighting & materials", slug: "pooja-iyer" },
  { name: "Nikhil Sawant", role: "Designer · Apartments", slug: "nikhil-sawant" },
  { name: "Tanvi Rane", role: "Designer · Single rooms", slug: "tanvi-rane" },
  { name: "Arjun Nair", role: "Designer · Independent houses", slug: "arjun-nair" },
  { name: "Riya Chopra", role: "Designer · Kitchens", slug: "riya-chopra" },
  { name: "Siddharth Pawar", role: "Designer · Studios & clinics", slug: "siddharth-pawar" },
];

export const slugOf = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
export const avatarFor = (name: string) => {
  const r = ROSTER.find((x) => x.slug === slugOf(name));
  return r ? `/designers/${r.slug}.svg` : null;
};
export const roleFor = (name: string) => ROSTER.find((x) => x.slug === slugOf(name))?.role ?? "Designer";
