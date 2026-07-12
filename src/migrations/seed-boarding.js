require('dotenv').config();
const { User, VendorProfile, BoardingPlace } = require('../models');

/**
 * Populates a handful of publicly-visible boarding-place listings so the
 * Bordima filters (city/room type/gender/rent/university) have real data to
 * test against. Every QA test case for that page was failing "No boarding
 * places found" for every filter - not because the filters are broken, but
 * because getBoardingPlaces() only returns rows that are isActive=true,
 * (isPaid=true or isFreeTrialAd=true), approvalStatus='approved', and not
 * yet expired - and nothing in this environment had ever produced a row
 * satisfying all four (no seed data, FREE_TRIAL_ENABLED unset, no admin
 * approvals). This script creates listings that already satisfy them.
 *
 * Run manually against a dev/QA database: node src/migrations/seed-boarding.js
 * Do NOT run this against production.
 */
const seedBoardingData = async () => {
  try {
    console.log('Seeding boarding place listings...');

    const [vendorUser] = await User.findOrCreate({
      where: { email: 'boarding.vendor@unihub.com' },
      defaults: {
        firstName: 'Boarding',
        lastName: 'Vendor',
        email: 'boarding.vendor@unihub.com',
        password: 'vendor123',
        roles: ['vendor'],
        primaryRole: 'vendor',
        isVerified: true,
        isActive: true,
        isVendorProfileComplete: true,
      },
    });

    await VendorProfile.findOrCreate({
      where: { userId: vendorUser.id },
      defaults: {
        userId: vendorUser.id,
        shopName: 'Colombo Student Housing',
        shopDescription: 'Boarding places near major universities',
        businessType: 'individual',
        contactEmail: vendorUser.email,
        approvalStatus: 'approved',
      },
    });

    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const listings = [
      {
        title: 'Cozy Single Room Near UOC',
        description: 'Quiet single room, 5 minutes walk to University of Colombo.',
        address: '12 Reid Avenue, Colombo 07',
        city: 'Colombo',
        nearestUniversity: 'University of Colombo',
        distanceToUniversity: 0.5,
        roomType: 'single',
        genderPreference: 'any',
        capacity: 1,
        availableSlots: 1,
        monthlyRent: 15000,
        contactPhone: '0771234567',
        contactEmail: vendorUser.email,
      },
      {
        title: 'Shared Room for Female Students',
        description: 'Shared 2-bed room, female-only, close to public transport.',
        address: '45 Havelock Road, Colombo 05',
        city: 'Colombo',
        nearestUniversity: 'University of Colombo',
        distanceToUniversity: 2.1,
        roomType: 'shared',
        genderPreference: 'female',
        capacity: 2,
        availableSlots: 2,
        monthlyRent: 9000,
        contactPhone: '0771234568',
        contactEmail: vendorUser.email,
      },
      {
        title: 'Male Annex Near University of Moratuwa',
        description: 'Private annex with attached bathroom, male students only.',
        address: '8 Katubedda Road, Moratuwa',
        city: 'Moratuwa',
        nearestUniversity: 'University of Moratuwa',
        distanceToUniversity: 1.2,
        roomType: 'annex',
        genderPreference: 'male',
        capacity: 1,
        availableSlots: 1,
        monthlyRent: 20000,
        contactPhone: '0771234569',
        contactEmail: vendorUser.email,
      },
      {
        title: 'Budget Apartment Near University of Kelaniya',
        description: 'Small apartment suitable for 2-3 students sharing.',
        address: '23 Kandy Road, Kelaniya',
        city: 'Kelaniya',
        nearestUniversity: 'University of Kelaniya',
        distanceToUniversity: 0.8,
        roomType: 'apartment',
        genderPreference: 'any',
        capacity: 3,
        availableSlots: 3,
        monthlyRent: 27000,
        contactPhone: '0771234570',
        contactEmail: vendorUser.email,
      },
      {
        title: 'Affordable Single Room in Peradeniya',
        description: 'Single room within walking distance of the university.',
        address: '5 Galaha Road, Peradeniya',
        city: 'Peradeniya',
        nearestUniversity: 'University of Peradeniya',
        distanceToUniversity: 0.6,
        roomType: 'single',
        genderPreference: 'any',
        capacity: 1,
        availableSlots: 1,
        monthlyRent: 8000,
        contactPhone: '0771234571',
        contactEmail: vendorUser.email,
      },
    ];

    for (const listing of listings) {
      await BoardingPlace.findOrCreate({
        where: { vendorId: vendorUser.id, title: listing.title },
        defaults: {
          ...listing,
          vendorId: vendorUser.id,
          isActive: true,
          isPaid: true,
          paidAt: new Date(),
          approvalStatus: 'approved',
          isApproved: true,
          expiresAt: thirtyDaysFromNow,
        },
      });
    }

    console.log(`Seeded ${listings.length} approved boarding listings for vendor ${vendorUser.email}`);
    process.exit(0);
  } catch (error) {
    console.error('Boarding seed failed!');
    if (error.name === 'SequelizeValidationError') {
      console.error('Validation Errors:', error.errors.map((e) => `${e.path}: ${e.message}`));
    }
    console.error(error);
    process.exit(1);
  }
};

seedBoardingData();
