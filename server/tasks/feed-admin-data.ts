export default defineTask({
  meta: {
    name: 'seed-mock-subscribers',
    description: 'Seed mock subscribers and feedback to the database',
  },
  async run() {
    console.log('Running DB seed task...')
    // delete all existing subscribers and feedback first
    await useDB().delete(tables.subscribers)
    await useDB().delete(tables.feedback)
    const subscribers = [
      {
        email: 'john@example.com',
        referrer: 'https://google.com',
      },
      {
        email: 'sarah.smith@example.com',
        referrer: 'https://twitter.com',
      },
      {
        email: 'mike.jones@example.com',
        referrer: 'https://supersaas.dev',
      },
      {
        email: 'emily.brown@example.com',
        referrer: 'https://facebook.com',
      },
      {
        email: 'david.wilson@example.com',
        referrer: 'https://reddit.com',
      },
      {
        email: 'lisa.taylor@example.com',
        referrer: 'https://youtube.com',
      },
      {
        email: 'james.anderson@example.com',
        referrer: 'https://instagram.com',
      },
      {
        email: 'amy.martinez@example.com',
        referrer: null,
      },
      {
        email: 'robert.thomas@example.com',
        referrer: 'https://medium.com',
      },
      {
        email: 'jennifer.white@example.com',
        referrer: 'https://github.com',
      },
    ]
    const feedback = [
      {
        id: 'kEzs5L3qt28HJ8WM23Mle',
        user: 'Y258GqJifNcbs5uyFaxlT',
        message:
          'App freezes immidiately and we have no idea why this is happening, I have cleared my browser cache, restarted my browser, nothing seems to work \n\nPlease this immidiately, this is costing me money',
        status: 'pending',
        reply: null,
        meta: {
          browser:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
          screenResolution: '1920x968',
          language: 'en-US',
          platform: 'MacIntel',
          colorScheme: 'system',
          timezone: 'Asia/Calcutta',
          url: 'http://localhost:3000/dashboard/campsite',
        },
        createdAt: new Date('2025-03-21T04:04:57.000Z'),
      },
      {
        id: 'X1a2B3C4D5E6F7G8H9I0J',
        user: 'AhvIjk_YPW2fpGvaOf4uP',
        message:
          'The dark mode setting keeps resetting to light mode after refreshing the page. Very frustrating!',
        status: 'pending',
        reply: null,
        meta: {
          browser:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
          screenResolution: '1920x1080',
          language: 'en-US',
          platform: 'Win32',
          colorScheme: 'dark',
          timezone: 'America/New_York',
          url: 'http://localhost:3000/settings',
        },
        createdAt: new Date('2025-02-21T04:05:00.000Z'),
      },
      {
        id: 'L2M3N4O5P6Q7R8S9T0U1V',
        user: 'g9-i8jS9l19ZIbq1dhOsb',
        message:
          "Payments are failing when I try to use my credit card. It keeps saying 'unexpected error'. Please fix ASAP!",
        status: 'pending',
        reply: null,
        meta: {
          browser:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
          screenResolution: '1440x900',
          language: 'en-GB',
          platform: 'MacIntel',
          colorScheme: 'light',
          timezone: 'Europe/London',
          url: 'http://localhost:3000/checkout',
        },
        createdAt: new Date('2024-03-21T04:03:15.000Z'),
      },
      {
        id: 'W2X3Y4Z5A6B7C8D9E0F1G',
        user: 'PyG2scznAG170OPyOoW9q',
        message:
          'The mobile app crashes when I try to upload an image. I tested on both WiFi and cellular, same issue.',
        status: 'pending',
        reply: null,
        meta: {
          browser:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/537.36',
          screenResolution: '1170x2532',
          language: 'en-US',
          platform: 'iOS',
          colorScheme: 'system',
          timezone: 'Asia/Singapore',
          url: 'http://localhost:3000/mobile-upload',
        },
        createdAt: new Date('2025-01-10T04:07:30.000Z'),
      },
      {
        id: 'H3I4J5K6L7M8N9O0P1Q2R',
        user: 'TaVaZnnQsV65NJZE0Ywyh',
        message:
          'Live chat widget is not loading on our company dashboard. Tried multiple browsers, no luck.',
        status: 'open',
        reply: null,
        meta: {
          browser:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
          screenResolution: '1366x768',
          language: 'en-US',
          platform: 'Win32',
          colorScheme: 'light',
          timezone: 'America/Chicago',
          url: 'http://localhost:3000/dashboard/chat',
        },
        createdAt: new Date('2025-03-21T04:08:45.000Z'),
      },
      {
        id: 'S4T5U6V7W8X9Y0Z1A2B3C',
        user: 'KMgg81zhmu32kEwrDY-S9',
        message:
          "Downloaded reports are missing crucial columns like 'Revenue' and 'Customer ID'. Can you fix this?",
        status: 'pending',
        reply: null,
        meta: {
          browser:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36',
          screenResolution: '2560x1600',
          language: 'fr-FR',
          platform: 'MacIntel',
          colorScheme: 'dark',
          timezone: 'Europe/Paris',
          url: 'http://localhost:3000/reports',
        },
        createdAt: new Date('2025-03-18T04:09:20.000Z'),
      },
    ]
    await useDB().insert(tables.subscribers).values(subscribers)
    await useDB().insert(tables.feedback).values(feedback)
    return { result: 'success' }
  },
})
