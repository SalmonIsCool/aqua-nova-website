export interface StaffRole {
  slug: string;
  title: string;
  description: string;
  open: boolean;
  formName: string;
  applicationType: string;
}

export const staffRoles: StaffRole[] = [
  {
    slug: "human-resources",
    title: "Human Resources",
    description:
      "The moderators of our Discord. They oversee driver activity and reports. You will help with driver problems, activity and behaviour, and help guard our Discord server as a moderator.",
    open: true,
    formName: "staff-human-resources",
    applicationType: "Human Resources — Staff Application"
  },
  {
    slug: "media",
    title: "Media Team",
    description:
      "Creates pictures, branding, banners, and Aqua Nova Transport media for public distribution. You will help with our branding, advertisements, and social media presence.",
    open: true,
    formName: "staff-media",
    applicationType: "Media Team — Staff Application"
  },
  {
    slug: "recruitment",
    title: "Recruitment Team",
    description:
      "Recruits new drivers by reading and reviewing applications. You will help welcome applicants, review join requests, and support drivers through the onboarding process.",
    open: true,
    formName: "staff-recruitment",
    applicationType: "Recruitment Team — Staff Application"
  },
  {
    slug: "public-relations",
    title: "Public Relations Team",
    description:
      "Responsible for maintaining our social media platforms and public image. You will help represent Aqua Nova Transport online and keep our community informed.",
    open: true,
    formName: "staff-public-relations",
    applicationType: "Public Relations Team — Staff Application"
  }
];
