import * as Sentry from "@sentry/node";

export async function searchIfNumbersAreExclusive({
  numbers
}: {
  numbers: number[];
}): Promise<{ [key: string]: boolean }> {
  let result = {};

  try {
    // ESTA API HACE EL FILTRADO DEL ARRAY QUE LE PASO
    const response = await fetch(
      "https://microservices.restaurant.pe/backendrestaurantpe/public/rest/common/localbi/searchPhoneList",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(numbers)
      }
    );

    if (!response.ok) {
      throw new Error(
        "searchIfNumbersAreExclusive was not ok " + response.statusText
      );
    }

    const data = await response.json();

    if (typeof data.data === "object") {
      for (const number in data.data) {
        if (data.data[number].some(o => o.isExclusive)) {
          data.data[number] = true;
        }
      }

      result = data.data;
    }
  } catch (error) {
    console.log("--- Error in searchIfNumbersAreExclusive", error);
    Sentry.captureException(error);
  }

  return result;
}
