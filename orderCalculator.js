const { money, logSection } = require("./logger");

function calculateOrder({
  order,
  addOns,
  promotion,
  ticketTypes,
  eventDetail
}) {
  let ticketCount = 0;
  // Gross amount is (ticket price * qty + service fee) WITHOUT discount deduction
  let grossAmount = 0;
  // Final amount is (ticket price * qty + service fee - discount) AFTER discount deduction
  let finalAmount = 0;
  let discountTotal = 0;
  let totalServiceFee = 0; // Track total service fee across all addOns
  let donationTotal = 0; // Track total donations
  let discountAppliedToOrder = false; // Track if discount has been applied to this order

  logSection("ORDER CALCULATION START");

  console.log("ED PF TOGGLE", eventDetail["No Processing Fee"]);
  // console.log("Order ID:", order._id);
  console.log("Promotion:", promotion ? `${promotion._id} (Type: ${promotion["OS GP Promotion Type"]}, Amount: ${promotion.DiscountAmt || "N/A"}, Pct: ${promotion.DiscountPct || "N/A"})` : "None");

addOns.forEach((addOn, index) => {
  // Handle Donation addOns separately
  if (addOn["OS AddOnType"] === "Donation") {
    // Donation amount is stored in "Gross Price" or "Final Price" field
    const donationAmount = addOn["Gross Price"] || addOn["Final Price"] || 0;
    donationTotal += donationAmount;
    console.log(`\nAddOn #${index + 1} (Donation)`);
    console.log("AddOn ID:", addOn._id);
    console.log("Donation Amount:", money(donationAmount));
    return;
  }

  // 🚨 HARD SKIP — FIRST LINE
  if (addOn["OS AddOnType"] !== "Ticket") {
    // console.log(
    //   `Skipping AddOn ${addOn._id} — type: ${addOn["OS AddOnType"]}`
    // );
    return;
  }

  const ticketType = ticketTypes[addOn.GP_TicketType];

  if (!ticketType) {
    throw new Error(
      `TicketType not loaded for Ticket AddOn ${addOn._id}`
    );
  }
  console.log("ADDON QTY",addOn.Quantity)
  const qty = addOn.Quantity;
  const ticketPrice = ticketType.Price;
  
  // Get service fee per ticket from GP_TicketType, default to 2 if not specified
  // However, if ticket price is 0, service fee is also 0
  const serviceFeePerTicket = ticketPrice === 0 ? 0 : (ticketType["Service Fee"] || 2);

  ticketCount += qty;

  const serviceFee = serviceFeePerTicket * qty;
  totalServiceFee += serviceFee;

  let discount = 0;
  let discountApplied = false;

  if (
    promotion &&
    ticketType.GP_Promotions?.includes(promotion._id)
  ) {
    discountApplied = true;

    if (promotion["OS GP Promotion Type"] === "Discount Amount") {
      // Fixed amount discounts are applied once per order, not per addOn
      if (!discountAppliedToOrder) {
        discount = promotion.DiscountAmt;
        discountAppliedToOrder = true; // Mark that discount has been applied
        console.log(`  → Applying Discount Amount: ${money(promotion.DiscountAmt)} (once per order)`);
      } else {
        console.log(`  → Discount Amount already applied to this order, skipping`);
      }
    }

    if (promotion["OS GP Promotion Type"] === "Discount Percentage") {
      // Percentage discounts are applied per addOn
      discount = (ticketPrice * qty) * (promotion.DiscountPct);
      console.log(`  → Applying Discount Percentage: ${promotion.DiscountPct} on ${money(ticketPrice * qty)} = ${money(discount)} per addOn`);
    }
  } else if (promotion) {
    console.log(`  → Promotion exists but not applicable to this ticket type`);
  }

  discountTotal += discount;

  const addOnGross = (ticketPrice * qty) + serviceFee;
  const addOnFinal = addOnGross - discount;

  grossAmount += addOnGross;
  finalAmount += addOnFinal;

  console.log(`\nAddOn #${index + 1} (Ticket)`);
  console.log("AddOn ID:", addOn._id);
  console.log("Qty:", qty);
  console.log("Ticket Price:", money(ticketPrice));
  console.log("Service Fee per Ticket:", money(serviceFeePerTicket));
  console.log("Service Fee (total):", money(serviceFee));
  console.log("Discount:", money(discount));
  console.log("AddOn Gross (before discount):", money(addOnGross));
  console.log("AddOn Final (after discount):", money(addOnFinal));
});


  logSection("FEES");

  // Check if processing fees should be excluded
  const noProcessingFee = eventDetail["No Processing Fee"] === true || eventDetail["No Processing Fee"] === "Yes";
  
  // Check if base amount is 0 - if so, no processing fees apply
  const baseAmount = finalAmount + donationTotal;
  const isZeroOrder = baseAmount === 0 || Math.abs(baseAmount) < 0.01;
  
  let processingFeeRevenue = 0;
  let totalOrderValue;
  let stripeDeduction;

  if (isZeroOrder) {
    // If total order value is 0, no processing fees apply
    console.log("Total Order Value is 0 - No processing fees applied");
    totalOrderValue = 0;
    processingFeeRevenue = 0;
    stripeDeduction = 0;
  } else if (noProcessingFee) {
    // When "No Processing Fee" is true:
    // - Processing fee revenue is 0
    // - Total order value does NOT include processing fees
    // - Stripe deduction is still calculated on totalOrderValue (which includes donations)
    console.log("No Processing Fee: true - Processing fees excluded from total order value");

    // In "No Processing Fee" mode, Bubble's Total Order Value excludes processing fees
    // AND does not get "grossed up" to cover Stripe. The customer pays the finalAmount,
    // and Stripe deduction is calculated separately on that charged amount.
    // Donations are added to totalOrderValue but NOT included in processingFeeRevenue calculation
    totalOrderValue = finalAmount + donationTotal;

    // Stripe deduction is calculated on the charged total (including donations).
    stripeDeduction = (totalOrderValue * 0.029) + 0.3;
  } else {
    // Processing fee revenue is calculated on totalOrderValue (similar to Stripe deduction)
    // This creates a circular dependency that we solve algebraically:
    //
    // Let:
    //   PF = processingFeeRevenue = PF_fixed + (TOV * PF_pct)
    //   TOV = totalOrderValue = (FA + PF + 0.3) / 0.971
    //   FA = finalAmount
    //   PF_fixed = eventDetail["Processing Fee $"] || 0
    //   PF_pct = eventDetail["Processing Fee %"] || 0
    //
    // Substituting PF into TOV:
    //   TOV = (FA + PF_fixed + (TOV * PF_pct) + 0.3) / 0.971
    //   TOV * 0.971 = FA + PF_fixed + (TOV * PF_pct) + 0.3
    //   TOV * 0.971 - TOV * PF_pct = FA + PF_fixed + 0.3
    //   TOV * (0.971 - PF_pct) = FA + PF_fixed + 0.3
    //   TOV = (FA + PF_fixed + 0.3) / (0.971 - PF_pct)
    
    const processingFeeFixed = eventDetail["Processing Fee $"] || 0;
    const processingFeePct = eventDetail["Processing Fee %"] || 0;
    
    // Calculate totalOrderValue accounting for processing fee percentage on totalOrderValue
    // IMPORTANT: Processing fee is calculated on tickets portion only, NOT including donations
    // But Stripe deduction is calculated on the total (including donations)
    //
    // Strategy:
    // 1. Calculate base order value for tickets (with processing fees, grossed up for Stripe)
    // 2. Add donations to get total order value
    // 3. Calculate Stripe deduction on the total (including donations)
    const denominator = 0.971 - processingFeePct;
    if (denominator <= 0) {
      throw new Error(`Invalid processing fee percentage: ${processingFeePct}. Denominator would be ${denominator}`);
    }
    
    // Calculate base totalOrderValue for tickets only (for processing fee calculation)
    // This already accounts for Stripe deduction on the tickets portion
    const totalOrderValueBase =
      (finalAmount + processingFeeFixed + 0.3) / denominator;

    // Processing fee revenue is calculated on base totalOrderValue (excluding donations)
    processingFeeRevenue =
      processingFeeFixed +
      (totalOrderValueBase * processingFeePct);

    // Total order value calculation:
    // - Tickets portion: already grossed up for Stripe in totalOrderValueBase
    // - Donations: need to be grossed up for Stripe too
    // Formula for donations: donationGrossedUp = (donationTotal + 0.3) / 0.971
    // But wait, we already have 0.3 in the base calculation...
    // Actually, donations should be added and then the total should account for Stripe
    // Let's try: totalOrderValue = (totalOrderValueBase - baseStripe) + donations, then gross up total
    // Or simpler: totalOrderValue = totalOrderValueBase + (donationTotal / 0.971)
    
    // Calculate donations grossed up for Stripe (they need their own Stripe fee)
    // But we need to account for the fact that 0.3 is already in the base calculation
    // So we calculate: donationGrossedUp = donationTotal / 0.971
    const donationGrossedUp = donationTotal / 0.971;
    
    // Total order value = tickets base + donations grossed up
    totalOrderValue = totalOrderValueBase + donationGrossedUp;

    // Stripe deduction is calculated on totalOrderValue (including donations)
    stripeDeduction = (totalOrderValue * 0.029) + 0.3;
  }

  console.log("No Processing Fee:", noProcessingFee ? "Yes" : "No");
  console.log("Processing Fee $ (event):", money(eventDetail["Processing Fee $"]));
  console.log("Processing Fee % (event):", eventDetail["Processing Fee %"]);
  console.log("Processing Fee Revenue:", money(processingFeeRevenue));
  console.log("Stripe Deduction (2.9% + 0.30):", money(stripeDeduction));

  logSection("TOTALS");

  console.log("Ticket Count:", ticketCount);
  console.log("Total Service Fee:", money(totalServiceFee));
  console.log("Donation Total:", money(donationTotal));
  console.log("Gross Amount (before discount):", money(grossAmount));
  console.log("Final Amount (after discount):", money(finalAmount));
  console.log("Discount Total (calculated):", money(discountTotal));
  console.log("Discount Amount (from Bubble):", order["Discount Amount"] || "N/A");
  console.log("Bubble Gross Amount:", order["Gross Amount"] || "N/A");
  console.log("Calculated Gross Amount:", money(grossAmount));
  console.log("Difference in discount (Bubble - Calculated):", money((order["Discount Amount"] || 0) - discountTotal));
  console.log("Total Order Value:", money(totalOrderValue));

  logSection("ORDER CALCULATION END");

  return {
    ticketCount,
    grossAmount,
    totalServiceFee,
    donationTotal,
    discountTotal,
    processingFeeRevenue,
    stripeDeduction,
    totalOrderValue
  };
}

module.exports = { calculateOrder };
