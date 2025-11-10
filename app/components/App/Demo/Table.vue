<template>
  <AppDemoCard title="Contacts">
    <div class="overflow-x-auto">
      <table class="w-full">
        <tbody>
          <tr
            v-for="contact in contacts"
            :key="contact.id"
            class="border-b border-neutral-100 text-sm text-neutral-500 hover:bg-neutral-50 dark:border-white/10 dark:text-neutral-400 dark:hover:bg-neutral-800/50 [&>td]:whitespace-nowrap"
          >
            <td class="p-2">
              <div class="flex items-center gap-2">
                <UAvatar :src="contact.avatar" :alt="contact.name" size="2xs" />
                {{ contact.name }}
              </div>
            </td>
            <td class="p-2">
              <div class="flex items-center gap-2">
                <UAvatar
                  :src="contact.logo"
                  size="2xs"
                  :alt="contact.company + ' logo'"
                />
                {{ contact.company }}
              </div>
            </td>
            <td class="p-2">{{ contact.email }}</td>
            <td class="p-2">{{ contact.phone }}</td>
            <td class="p-2">
              <UBadge
                class="w-20"
                variant="subtle"
                :ui="{
                  leadingIcon: 'size-3',
                }"
                :color="
                  contact.status === 'Active'
                    ? 'success'
                    : contact.status === 'Inactive'
                      ? 'info'
                      : 'warning'
                "
                :icon="
                  contact.status === 'Active'
                    ? 'i-lucide-circle'
                    : contact.status === 'Inactive'
                      ? 'i-lucide-circle-dashed'
                      : 'i-lucide-circle-dot-dashed'
                "
              >
                {{ contact.status }}
              </UBadge>
            </td>
            <td class="p-2 text-right">{{ contact.ARR }}</td>
            <td class="p-2">{{ contact.country }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </AppDemoCard>
</template>

<script setup lang="ts">
const contacts = [
  {
    id: 1,
    name: 'Sarah Chen',
    avatar: 'https://i.pravatar.cc/150?img=1',
    email: 'sarah.chen@vercel.com',
    phone: '+1 415 555 0123',
    company: 'Vercel',
    logo: `https://logo.clearbit.com/${encodeURIComponent(
      'https://www.vercel.com',
    )}`,
    status: 'Active',
    ARR: '$110K',
    country: '🇺🇸 United States',
  },
  {
    id: 2,
    name: 'Tarun Talwar',
    avatar: 'https://i.pravatar.cc/150?img=2',
    email: 'tarun.talwar@jio.com',
    phone: '+1 206 555 0134',
    company: 'Jio',
    logo: `https://logo.clearbit.com/${encodeURIComponent(
      'https://www.jio.com',
    )}`,
    status: 'Active',
    ARR: '$460K',
    country: '🇮🇳 India',
  },
  {
    id: 3,
    name: 'Emma Thompson',
    avatar: 'https://i.pravatar.cc/150?img=3',
    email: 'emma.t@openai.com',
    phone: '+1 650 555 0145',
    company: 'Google',
    logo: `https://logo.clearbit.com/${encodeURIComponent(
      'https://www.openai.com',
    )}`,
    status: 'Inactive',
    ARR: '$1.9M',
    country: '🇺🇸 United States',
  },
  {
    id: 4,
    name: 'James Wilson',
    avatar: 'https://i.pravatar.cc/150?img=4',
    email: 'jwilson@campsite.com',
    phone: '+1 206 555 0156',
    company: 'Campsite',
    logo: `https://logo.clearbit.com/${encodeURIComponent(
      'https://www.campsite.com',
    )}`,
    status: 'Active',
    ARR: '$210M',
    country: '🇬🇧 United Kingdom',
  },
  {
    id: 5,
    name: 'Lisa Park',
    avatar: 'https://i.pravatar.cc/150?img=5',
    email: 'lisa.park@paypal.com',
    phone: '+1 408 555 0167',
    company: 'Paypal',
    logo: `https://logo.clearbit.com/${encodeURIComponent(
      'https://www.paypal.com',
    )}`,
    status: 'Active',
    ARR: '$908K',
    country: '🇺🇸 United States',
  },
  {
    id: 6,
    name: 'David Kumar',
    avatar: 'https://i.pravatar.cc/150?img=6',
    email: 'd.kumar@stripe.com',
    phone: '+1 650 555 0178',
    company: 'Stripe',
    logo: `https://logo.clearbit.com/${encodeURIComponent(
      'https://www.stripe.com',
    )}`,
    status: 'Pending',
    ARR: '$330M',
    country: '🇮🇪 Ireland',
  },
  {
    id: 7,
    name: 'Sophie Martin',
    avatar: 'https://i.pravatar.cc/150?img=7',
    email: 's.martin@adobe.com',
    phone: '+1 415 555 0189',
    company: 'Adobe',
    logo: `https://logo.clearbit.com/${encodeURIComponent(
      'https://www.adobe.com',
    )}`,
    status: 'Active',
    ARR: '$1.2M',
    country: '🇺🇸 United States',
  },
  {
    id: 8,
    name: 'Robert Zhang',
    avatar: 'https://i.pravatar.cc/150?img=8',
    email: 'r.zhang@shopify.com',
    phone: '+1 503 555 0190',
    company: 'Shopify',
    logo: `https://logo.clearbit.com/${encodeURIComponent(
      'https://www.shopify.com',
    )}`,
    status: 'Active',
    ARR: '$620M',
    country: '🇰🇷 South Korea',
  },
  {
    id: 9,
    name: 'Maria Garcia',
    avatar: 'https://i.pravatar.cc/150?img=9',
    email: 'm.garcia@notion.so',
    phone: '+1 415 555 0112',
    company: 'Notion',
    logo: `https://logo.clearbit.com/${encodeURIComponent(
      'https://www.notion.so',
    )}`,
    status: 'Inactive',
    ARR: '$2M',
    country: '🇯🇵 Japan',
  },
  {
    id: 10,
    name: 'Daniel Lee',
    avatar: 'https://i.pravatar.cc/150?img=10',
    email: 'd.lee@mintlify.com',
    phone: '+1 650 555 0123',
    company: 'Mintlify',
    logo: `https://logo.clearbit.com/${encodeURIComponent(
      'https://www.mintlify.com',
    )}`,
    status: 'Active',
    ARR: '$80K',
    country: '🇺🇸 United States',
  },
  {
    id: 11,
    name: 'Alexandra Brown',
    avatar: 'https://i.pravatar.cc/150?img=11',
    email: 'a.brown@twitter.com',
    phone: '+1 415 555 0134',
    company: 'Twitter',
    logo: `https://logo.clearbit.com/${encodeURIComponent(
      'https://www.twitter.com',
    )}`,
    status: 'Pending',
    ARR: '$108K',
    country: '🇺🇸 United States',
  },
  {
    id: 12,
    name: 'Enzo N',
    avatar: 'https://i.pravatar.cc/150?img=12',
    email: 'enzo.n@facebook.com',
    phone: '+1 650 555 0145',
    company: 'Facebook',
    logo: `https://logo.clearbit.com/${encodeURIComponent(
      'https://www.facebook.com',
    )}`,
    status: 'Active',
    ARR: '$890M',
    country: '🇫🇷 France',
  },
  {
    id: 13,
    name: 'Nina Patel',
    avatar: 'https://i.pravatar.cc/150?img=13',
    email: 'n.patel@apple.com',
    phone: '+1 408 555 0156',
    company: 'Apple',
    logo: `https://logo.clearbit.com/${encodeURIComponent(
      'https://www.apple.com',
    )}`,
    status: 'Active',
    ARR: '$1.2B',
    country: '🇨🇦 Canada',
  },
  {
    id: 14,
    name: "Kevin O'Brien",
    avatar: 'https://i.pravatar.cc/150?img=14',
    email: 'k.obrien@linkedin.com',
    phone: '+1 415 555 0167',
    company: 'LinkedIn',
    logo: `https://logo.clearbit.com/${encodeURIComponent(
      'https://www.linkedin.com',
    )}`,
    status: 'Active',
    ARR: '$450M',
    country: '🇺🇸 United States',
  },
  {
    id: 15,
    name: 'Julia Kim',
    avatar: 'https://i.pravatar.cc/150?img=15',
    email: 'j.kim@twenty.com',
    phone: '+1 408 555 0178',
    company: 'Twenty',
    logo: `https://logo.clearbit.com/${encodeURIComponent(
      'https://twenty.com/',
    )}`,
    status: 'Inactive',
    ARR: '$780M',
    country: '🇻🇳 Vietnam',
  },
  {
    id: 16,
    name: 'Carlos Mendoza',
    avatar: 'https://i.pravatar.cc/150?img=16',
    email: 'c.mendoza@uber.com',
    phone: '+1 415 555 0189',
    company: 'Uber',
    logo: `https://logo.clearbit.com/${encodeURIComponent(
      'https://www.uber.com',
    )}`,
    status: 'Active',
    ARR: '$320M',
    country: '🇧🇷 Brazil',
  },
  {
    id: 17,
    name: 'Rachel Wong',
    avatar: 'https://i.pravatar.cc/150?img=17',
    email: 'r.wong@airbnb.com',
    phone: '+1 415 555 0190',
    company: 'Airbnb',
    logo: `https://logo.clearbit.com/${encodeURIComponent(
      'https://www.airbnb.com',
    )}`,
    status: 'Active',
    ARR: '$560M',
    country: '🇺🇸 United States',
  },
  {
    id: 18,
    name: 'Ahmed Hassan',
    avatar: 'https://i.pravatar.cc/150?img=18',
    email: 'a.hassan@spotify.com',
    phone: '+1 212 555 0112',
    company: 'Spotify',
    logo: `https://logo.clearbit.com/${encodeURIComponent(
      'https://www.spotify.com',
    )}`,
    status: 'Pending',
    ARR: '$290M',
    country: '🇸🇪 Sweden',
  },
  {
    id: 19,
    name: 'Isabella Silva',
    avatar: 'https://i.pravatar.cc/150?img=19',
    email: 'i.silva@netflix.com',
    phone: '+1 650 555 0123',
    company: 'Netflix',
    logo: `https://logo.clearbit.com/${encodeURIComponent(
      'https://www.netflix.com',
    )}`,
    status: 'Active',
    ARR: '$980M',
    country: '🇪🇸 Spain',
  },
  {
    id: 20,
    name: 'William Taylor',
    avatar: 'https://i.pravatar.cc/150?img=20',
    email: 'w.taylor@slack.com',
    phone: '+1 415 555 0134',
    company: 'Slack',
    logo: `https://logo.clearbit.com/${encodeURIComponent(
      'https://www.slack.com',
    )}`,
    status: 'Active',
    ARR: '$850M',
    country: '🇺🇸 United States',
  },
]
</script>
