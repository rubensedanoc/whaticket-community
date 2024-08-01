export async function searchIfNumbersAreExclusive({
  numbers
}: {
  numbers: number[];
}): Promise<{ [key: string]: boolean }> {
  const url =
    "https://microservices.restaurant.pe/backendrestaurantpe/public/rest/common/localbi/searchPhoneList";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(numbers)
  });

  if (!response.ok) {
    throw new Error(
      "searchIfNumbersAreExclusive was not ok " + response.statusText
    );
  }

  const data = await response.json();

  // console.log(
  //   "----------------- searchIfNumbersAreExclusive ENTRADA:",
  //   numbers
  // );

  if (typeof data.data === "object") {
    for (const number in data.data) {
      if (data.data[number].some(o => o.isExclusive)) {
        data.data[number] = true;
      }
    }

    return data.data;
  } else {
    return {};
  }

  // console.log(
  //   "----------------- searchIfNumbersAreExclusive SALIDA:",
  //   data.data
  // );
}
