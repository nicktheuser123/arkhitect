const { getThing } = require("./bubbleClient");
const { calculateOrder } = require("./orderCalculator");
let order;
let result;

beforeAll(async () => {
  const ORDER_ID = "1770272331839x867325149898080300";

  order = await getThing("GP_Order", ORDER_ID);

  const addOns = await Promise.all(
    order["Add Ons"].map(id => getThing("GP_AddOn", id))
  );

  const promotion = order.GP_Promotion
    ? await getThing("GP_Promotion", order.GP_Promotion)
    : null;

  const event = await getThing("event", order.Event);
  const eventDetail = await getThing(
    "GP_EventDetail",
    event.GP_EventDetail
  );

  const ticketTypes = {};
  for (const addOn of addOns) {
    if (addOn["OS AddOnType"] !== "Ticket") continue;

    const ticketTypeId = addOn.GP_TicketType;
    if (!ticketTypes[ticketTypeId]) {
      ticketTypes[ticketTypeId] = await getThing(
        "GP_TicketType",
        ticketTypeId
      );
    }
  }

  result = calculateOrder({
    order,
    addOns,
    promotion,
    ticketTypes,
    eventDetail
  });
}, 30000); // 30 second timeout for async operations


describe("GP_Order financial validation", () => {

  it("validates Ticket Count", () => {
    expect(order["Ticket Count"]).toBe(result.ticketCount);
  });

  it("validates Gross Amount", () => {
    expect(order["Gross Amount"]).toBeCloseTo(result.grossAmount, 2);
  });

  it("validates Discount Amount", () => {
    // If GP_Promotion is empty, discount should be 0/undefined/empty and test should pass
    if (!order.GP_Promotion || order.GP_Promotion === "" || order.GP_Promotion === null) {
      // When there's no promotion, discountTotal should be 0
      expect(result.discountTotal).toBe(0);
      // Order's Discount Amount should be 0, undefined, null, or empty string
      const orderDiscount = order["Discount Amount"];
      expect(
        orderDiscount === 0 || 
        orderDiscount === undefined || 
        orderDiscount === null || 
        orderDiscount === ""
      ).toBe(true);
    } else {
      // Normal validation when promotion exists
      const orderDiscount = order["Discount Amount"];
      // If GP_Promotion exists but Discount Amount is undefined, test should fail
      if (orderDiscount === undefined || orderDiscount === null) {
        throw new Error(`Discount Amount is undefined/null but GP_Promotion exists (${order.GP_Promotion}) - discount should be calculated`);
      }
      // Validate discount amount matches calculated value
      expect(orderDiscount).toBeCloseTo(result.discountTotal, 2);
    }
  });

  it("validates Processing Fee Revenue", () => {
    // When total order value is 0, processing fee revenue should be 0
    if (result.totalOrderValue === 0 || Math.abs(result.totalOrderValue) < 0.01) {
      expect(result.processingFeeRevenue).toBe(0);
      // Bubble may have undefined/null or 0 for zero orders - treat undefined as 0
      const bubbleFee = order["Processing Fee Revenue"] || 0;
      expect(bubbleFee).toBe(0);
    } else {
      // Treat undefined as 0 for comparison
      const bubbleFee = order["Processing Fee Revenue"] || 0;
      expect(bubbleFee).toBeCloseTo(result.processingFeeRevenue, 2);
    }
  });

  it("validates Processing Fee Deduction", () => {
    // When total order value is 0, processing fee deduction should be 0
    if (result.totalOrderValue === 0 || Math.abs(result.totalOrderValue) < 0.01) {
      expect(result.stripeDeduction).toBe(0);
      // Bubble may have undefined/null or 0 for zero orders - treat undefined as 0
      const bubbleDeduction = order["Processing Fee Deduction"] || 0;
      expect(bubbleDeduction).toBe(0);
    } else {
      // Treat undefined as 0 for comparison
      const bubbleDeduction = order["Processing Fee Deduction"] || 0;
      expect(bubbleDeduction).toBeCloseTo(result.stripeDeduction, 2);
    }
  });

  it("validates Total Order Value", () => {
    expect(order["Total Order Value"])
      .toBeCloseTo(result.totalOrderValue, 2);
  });

  it("validates Total Service Fee", () => {
    expect(order["Fee Service"])
      .toBeCloseTo(result.totalServiceFee, 2);
  });

  it("validates Donation Amount", () => {
    // Compare calculated donation total with Bubble's "Donation Amount" field
    const bubbleDonationAmount = order["Donation Amount"] || 0;
    expect(bubbleDonationAmount).toBeCloseTo(result.donationTotal, 2);
  });

});
